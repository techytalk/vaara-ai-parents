# Post-time filter for abuse and off-topic replies

Brainstorm and spec. Do not ship until the decision rules and parent-facing
copy below are agreed.

## What parents are hitting

Anonymous circles make this cheap to do and hard to undo. Two patterns showed
up after the message was already visible:

| Case | Example | Why the current filter misses it |
| --- | --- | --- |
| Unrelated reply in English | On a school thread: “Will you marry me?” | Not in the English word list. It is not a slur. It is the wrong kind of message for this room. |
| Scolding in a local language | Telugu, Hindi, or another language used to abuse someone | `content-guard.ts` only matches a few English patterns. A Telugu insult never hits them. Roman-script Telugu (“Tenglish”) looks like English to a naive check and still is not in the list. |

Today the bad line is published, other parents see it, and ops hides it later
from `/internal/admin/moderation.html`. That is the right tool for what
already shipped. It is the wrong tool for the moment of send.

**Goal:** decide before insert. If the message should not be in a parent
circle, the sender gets an error and nobody else ever sees the text.

## What we already have

| Piece | What it does | Gap |
| --- | --- | --- |
| `apps/api/src/lib/content-guard.ts` | Blocks a short English list: sexual content, threats, a few slurs, plus medical dosing. | No local languages. No “this reply does not belong here.” |
| `guardText()` in `apps/api/src/services/chat.ts` | Runs that list on new threads, circle messages, and edits, before insert. | Same gap. Direct messages skip it entirely. |
| Admin hide (`status = 'moderated'`) | After the fact. Parents see “Blocked as inappropriate.” | The harm already happened. |
| `users.content_blocked` | Suspends further sends. Parents see “This profile is suspended.” | Manual. Does not judge one message. |

The new check sits in the same place as `guardText()`: **the API, before the
row is written**. A check that lives only in the app can be skipped.

We are **not** growing `content-guard.ts` with more phrases (“will you marry
me”, insult lists, language-specific dictionaries). A phrase list misses the
next wording the same day it ships, and it misses local language entirely.
The medical dosing rules stay where they are. They are a separate rule about
medicine, not this filter.

## How a send is checked

TypeSafe has paused Jev signups, so the first version does not call Jev.
The translation step needed a model that can write anyway. One such model
does the whole check.

Use Gemini Flash (`gemini-flash-latest`) through the Gemini API. It handles
Hindi, Telugu, and mixed text, and it returns a fixed JSON object. Our code
applies the thresholds. The model does not decide to publish.

Credential: `GEMINI_API_KEY` from Google AI Studio. Model id
`gemini-flash-latest` (the current Gemini Flash; `gemini-3-flash` is not a
live model id). Thinking stays low, the lowest level this model accepts. No Flash-Lite and no second model.

Jev can replace the three scores later. The JSON shape below stays.

```text
parent taps Send
        |
        v
account already suspended? -- yes --> "This profile is suspended"
        |
        no
        v
one Gemini call, structured JSON
  is this English, or another language?
  if another language:
      name it
      translate to English, same tone
  then, on that English:
      filthy?
      sexual or romantic?
      harassing?
        |
        +-- any score >= 0.85 ------> do not publish
        |                             keep their text in the draft
        |                             community-guidelines message
        |
        +-- otherwise ---------------> save the message
```

One call is the send path. Gemini returns language, translation, and the three scores in the same JSON object, and the parent waits once. A second call would run only after this one shows a bad translation in the shadow log: the English text reads polite while a score is high, or the other way around. Until that shows up, splitting adds wait time on every send and does not catch a softened insult any better, because the second call would be scoring that same translation.

The prompt tells the model to keep the force of the original. An insult stays an insult in `english`. The scores describe that same meaning. A mix, or local language written in English letters, counts as not English.

### What the call returns

Input is the new text plus, for a reply, the thread title and a short snippet
of the message being answered. No email, phone, child profile, or handle.

| Field | What it is |
| --- | --- |
| `isEnglish` | `true` only when the message is English. A mix is `false`. |
| `language` | Short name when `isEnglish` is false (`Telugu`, `Hindi`, `mixed Hindi and English`). Empty when it is English. We do not hand the model a language list. |
| `english` | Translation, same tone, when `isEnglish` is false. Empty when it is already English. An insult stays an insult. |
| `filthy` | 0–1. Foul language, insults, slurs. |
| `sexualOrRomantic` | 0–1. Sex, pornography, or romancing, including a proposition. |
| `harassing` | 0–1. Scolding, threats, or sexual harassment aimed at someone. |

When the message is allowed and it was not English, other parents see both.
The original is the message. The English from this call sits under it, in the
same bubble. A message that was already English has no second line.
A blocked message is not published, so nobody else sees the original or the
English.

The translation is not a second message and not a heading with a blank line
under it. Same bubble, 6px under the original. The word “English” is an 11px
caption. The translation is 13px and muted (on a teal bubble, white at about
80% opacity). Inbox previews and notifications show the original only.

```text
┌──────────────────────────────┐
│ Bus late ayindi, driver was  │  15px
│ rude.                        │
│                              │  6px
│ English                      │  11px, muted
│ The bus was late, the driver │  13px, muted
│ was rude.                    │
│                       6:12am │
└──────────────────────────────┘
```

A new post may be about parenting, a class, the school, or anything else
parents talk about here. The check does not ask “is this a parenting topic?”
A class question, a bus note, and a homework post all pass.

### Prompt

The system instruction is fixed. The user message is only the text being
sent, plus the thread title and the snippet being answered when this is a
reply. Scores stay in the model’s response. Our code decides publish or
draft.

```text
You review one message from a parent community before it is published.
Judge the full meaning and intent. Do not score high only because a sensitive
word appears. Parents write about school, class, buses, homework, health,
safety, puberty, pregnancy, and child sex education. That is fine when the
message is a genuine parenting discussion.

Foul language, insults, scolding, threats, sexualizing someone, and unwanted
romantic or sexual approaches aimed at another parent are not fine.

Return JSON only, with this shape:
{
  "isEnglish": true,
  "language": "",
  "english": "",
  "filthy": 0.0,
  "sexualOrRomantic": 0.0,
  "harassing": 0.0
}

isEnglish is true only when the message is English.
A mix of English and another language is not English.
Local language written in English letters is not English.
When isEnglish is true, language and english are empty strings.
When isEnglish is false, language is a short name you choose
(for example Telugu, Hindi, or mixed Hindi and English).
Do not pick from a fixed list.
english is the same message in English, same tone.
Keep insults, slurs, sexual remarks, and threats.
Do not soften them into polite wording.
The three scores describe that English meaning, from 0 to 1.

filthy: foul language, insults, or slurs used as abuse.
sexualOrRomantic: sex, pornography, or romancing aimed at someone,
including a proposition. Legitimate health, puberty, pregnancy, safety,
or educational discussion must score low even when those topics are named.
harassing: scolding, threats, or sexual harassment aimed at someone.

Score high only when the meaning is abusive, insulting, scolding,
threatening, sexualizing, or making an unwanted romantic or sexual approach
toward someone. Score low for a class, bus, homework, or other parenting
question. Do not score a message higher because it is off-topic.
```

A reply adds context under the message. A new post sends the message alone.

```text
Message:
"""
<the text they tapped Send on>
"""

Thread title: <only for a reply>
Replying to: <short snippet, only for a reply>
```

## Decision rules

Judge the full meaning and intent. Do not block only because a sensitive word
appears. A genuine parenting, health, safety, puberty, pregnancy, or
educational discussion must score low. Score high only when the meaning is
abusive, insulting, scolding, threatening, sexualizing, or making an unwanted
romantic or sexual approach toward someone.

Block when any signal reaches its line:

| Signal | Block when |
| --- | --- |
| `filthy` | ≥ 0.60 |
| `sexual_or_romantic` | ≥ 0.65 |
| `harassing` | ≥ 0.50 |

Elevated scores below those lines are allowed and logged for review. A clear
pass on all three is allowed and not stored a second time.

“Will you marry me?” fails `sexual_or_romantic`. A Telugu insult such as
“Nee bonda ra” is translated first, then fails `filthy` or `harassing`.
“How do I explain puberty?” and “Can pregnant parents join the trip?” pass.
“The bus is late”, a class question, and a homework note pass in any language.

### What the sender sees

The message is not published. Their text stays in the composer as a draft, so they can fix it and send again. Nothing is inserted, so there is no “Blocked as inappropriate” tombstone. That tombstone is only for messages ops hides after publish.

| Reason | Copy |
| --- | --- |
| `filthy`, `sexual_or_romantic`, or `harassing` | “We found foul language in this message. That goes against Vaara’s community guidelines. Please fix it and try again.” |
| Check unavailable after one retry | “We couldn’t check this message. Try again in a moment.” |

Same sentence for a new post and for a reply. Do not name the language. Do not quote the words. Do not say they cannot write in Telugu.

The API returns `400` with `{ "error": "<copy>", "code": "content_rejected" }`. The app keeps the draft on that code and shows the error. A network failure must not wipe what they typed.

### When a check is down

There is no phrase-list fallback. The model call gets one retry.
If it still fails, the send is refused with the retry copy. An unchecked
message does not go out.

A long outage would stop new messages. Ops gets a kill switch that skips the
check and publishes anyway, default off. Turning it on is written to the
audit log.

## Where it runs

Same surfaces as today’s guard, plus direct messages:

| Surface | Today | After |
| --- | --- | --- |
| New circle thread (`createThread`) | `guardText` | This check, then the existing medical check |
| Circle message and thread reply (`createCircleMessage`) | `guardText` | This check, then the existing medical check |
| Edit message (`editCircleMessage`) | `guardText` | This check. An edit is a new publication. |
| Circle post, post edit, post reply (`routes/circles.ts`) | `rejectObjectionableText` | This check |
| Cross-posts | `rejectObjectionableText` | This check |
| Direct messages | Length check only | This check. DMs are the quieter place to abuse someone. |

One module owns the model call. Routes do not each grow their own prompt.

The sexual, threat, and slur regexes in `content-guard.ts` come out of the
send path once this check is enforcing. Leaving them in place means two
policies, and the regex one is the hardcoded list we are dropping. Medical
dosing stays.

Attachments with no text stay as they are. This spec is text only.

## Audit, and repeat offenders

Every block writes a row ops can read. Allows in the review band are stored
too. Ordinary `ok` sends are not stored a second time.

| Column | Notes |
| --- | --- |
| `user_id` | Who tried to send |
| `surface` | `thread`, `message`, `post`, `dm`, `edit` |
| `circle_id` / `thread_id` | Nullable |
| `body` | Original text. Ops only. |
| `is_english` | `english` or `other` |
| `language` | Name from the writer model. Empty when the text was already English. |
| `english_text` | Translation stored on the message when it is allowed and was not English. Shown under the original. Empty when the text was already English. |
| `filthy` | Noul, 0–1 |
| `sexual_or_romantic` | Noul, 0–1 |
| `harassing` | Noul, 0–1 |
| `model` | Model id, `gemini-flash-latest` |
| `action` | `blocked` or `allowed` |
| `created_at` | |

Retention: keep blocked bodies and translations for 90 days, then delete
them. The scores and the language name can stay longer for counts.

Strikes, on top of the existing suspend switch:

| Blocks by the same user | What happens |
| --- | --- |
| 1 | Composer error only |
| 3 in 24 hours | Same error, and a row flagged for ops |
| 5 in 7 days | Set `users.content_blocked`. They can still read. They cannot send. Ops can clear it from the moderation page. |

Strikes count blocks, not allows. A parent who writes in Telugu all day about
school does not accumulate strikes.

## Privacy and latency

- The check runs on the server. The phone never calls the model.
- Send the message text and, for a reply, a short thread snippet. No email, phone, or child profile.
- Confirm the gateway retention terms before production. Prefer a no-training route.
- One call per send. English and translated messages take the same path.
- Identical text from the same user within a few minutes reuses the last decision.

## Rollout

1. **Shadow.** Run the full path on circle sends, store the row, still publish. Read a week of real messages. Compare the translation with the original on Telugu, Hindi, and mixed lines. Look for school posts blocked by mistake, and for scolding that the English check allowed.
2. **Enforce** blocks at the thresholds above, once that week looks right. Ship the composer error in the same step, so a block keeps the draft.
3. **Strikes and suspend** after the false-positive rate from step 1 is acceptable.
4. **DMs** on the same gate once circle send is stable.

Step 1 is mandatory. The translation has to keep the tone, or the English check is judging the wrong sentence.

## Open points to settle before build

1. **Model.** `gemini-flash-latest` only, with thinking low. Credential `GEMINI_API_KEY`.
2. **Key.** Create it in Google AI Studio and put it in `.env.local`. Do not commit it.
3. **Thresholds.** 0.85 is the shadow-mode starting line. Change it from the week of logs.
4. **Quoted abuse.** A parent pasting an insult to ask “what do I tell my child?” can look filthy after translation. Shadow mode shows how often. Until we see that, a high `filthy` or `harassing` score still blocks.
5. **Who may read the audit body and the translation.** Same admin login as moderation.
