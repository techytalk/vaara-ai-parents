# Vaara Parents — Business Functionality

How parents behave in real situations, and what the app offers them in response.

This document is **not** technical. It describes parent behaviour, the moment a need appears, and the feature that answers it. Each feature includes a simulated walkthrough so the intent is unambiguous before any code is written.

Implementation for everything here lives in [Feature Implementation Plan](./FEATURE_IMPLEMENTATION_PLAN.md).

---

## 1. Scope

| Included | Status |
|----------|--------|
| Tier 1 — five features that create the core loop | Documented below |
| Tier 2 — seven features that deepen retention | Documented below |
| Trust & identity (graduated disclosure) | Documented below |

**Deliberately excluded** (decided, not deferred by accident):

| Not building | Reason |
|--------------|--------|
| Group chat (3+ parents) | WhatsApp already owns this. Parents will not migrate their class group. Vaara competes on **discovery** and **cross-group knowledge**, not on chat. |
| Free-text hashtags | Produces `#screentime`, `#ScreenTime`, `#screen-time` as three dead rooms. Curated topics instead. |
| Points, badges, streaks | Parents are time-poor. Gamification reads as noise, not reward. |
| Stories / reels / short video | Expensive to build and moderate; wrong consumption mode for this audience. |
| AI parenting chatbot as a core feature | Commodity answer quality, zero network effect. Acceptable only as a small helper (summarise a thread, suggest a topic tag). |
| City-wide feeds early | Dilutes local density, which is the only thing that matters before critical mass. |

Growth mechanics are intentionally out of scope for this document and will be handled separately.

---

## 2. The three layers

Every feature belongs to exactly one layer. Mixing them is the main design risk.

```
IDENTITY          who you are          auto-derived from profile
                                       exclusive, local, never hand-created
                                       e.g. Gaudium CBSE Grade 6 parents

INTEREST          what you care about  opt-in, curated catalogue
                                       cross-cuts circles, broad reach
                                       e.g. screen time, exam stress

MARKETPLACE       what you need        open browse, pin-code targeted
                                       named and verified, not anonymous
                                       e.g. maths tutors, swimming coaching
```

**The rule that prevents fragmentation:** a parent may never hand-create a group whose membership the system can already compute. If the app knows the school, curriculum, and grade from the child's profile, the app creates that circle. Parents only create and follow **interests**.

---

## 3. Cast used in the walkthroughs

The same people appear throughout so behaviour stays consistent across features.

| Person | Situation | Shown in circles as |
|--------|-----------|---------------------|
| **Meera** | Aarav, CBSE Grade 6, Gaudium School. Lives in Green Valley Apartments, 560102 Koramangala. | `Parent-7F2A · CBSE · G6` |
| **Rajesh** | Ishaan, IGCSE Grade 8, Oakridge. Same pin code and apartment complex. | `Parent-3B9C · IGCSE · G8` |
| **Anitha** | Diya, CBSE Grade 5 at Gaudium, plus a 3-year-old. Green Valley. | `Parent-D41E · CBSE · G5` |
| **Fatima** | Relocating from Hyderabad. No school chosen yet. Renting in 560102. | `Parent-9K2M` |
| **Suresh Kumar** | Maths tutor, CBSE and ICSE, serves 560102 and 560103. | **Named publicly** — providers are not anonymous |
| **Sparkle Sports Academy** | Swimming and skating institution, 560102. | **Named publicly** |
| **Dr. Kavya Rao** | Pediatrician, guest for a scheduled Q&A session. | **Named publicly** |

Parents are anonymous to each other. Providers and experts are named and accountable. That asymmetry is deliberate and is the foundation of the trust model in section 6.

---

# Tier 1 — The core loop

Five features. Together they answer the three questions a parent actually has: *who is in my exact situation*, *who can I trust locally*, and *what did other parents decide*.

---

## 4.1 School + Class circle

**Layer:** Identity · **Auto-created** · Extends the existing circle system

### How parents behave today

Meera's school WhatsApp group has 180 parents across all grades. When she asks "is anyone else finding the Grade 6 maths syllabus heavy this term?", her message is buried in twenty forwards about a sports day. The Grade 6 parents she needs are in there somewhere, but there is no way to reach only them.

So parents create side groups by hand — "Gaudium 6B Moms", "Gaudium CBSE 6 2026" — and within a term there are four overlapping groups, each with a different subset of parents, and nobody knows which one is live.

### The trigger moment

A parent has a question that is only relevant to people with a child in **the same school and the same class**. Syllabus load, a specific teacher's approach, homework volume, a class trip, a substitute teacher, exam pattern changes.

Existing circles miss this:

| Circle they have | What it actually contains | Why it fails here |
|------------------|---------------------------|-------------------|
| School circle | All Gaudium parents, every grade | Too broad — Grade 1 parents cannot help |
| Class circle | All CBSE Grade 6 parents, every school | Too broad — different school, different syllabus pace |

### What Vaara provides

When a parent's child profile has **school + curriculum + grade**, the app automatically places them in a **School + Class circle**. No creation step, no admin, no invite, no naming decision.

| Property | Behaviour |
|----------|-----------|
| Created by | The system, when school and grade are both known |
| Joined by | Automatically, on profile save |
| Left by | Changing the child's school or grade — membership follows the profile |
| Named as | `Gaudium School · CBSE · Grade 6` — consistent, never a typo variant |
| Visibility | Only parents matching all three attributes |

When Aarav moves to Grade 7 next year, Meera silently leaves the Grade 6 circle and joins the Grade 7 one. Nobody administers this.

### Simulated walkthrough

> **Tuesday, 8:40 AM** — Meera opens Vaara. Under **School circles** she now sees a second card: `Gaudium School · CBSE · Grade 6 — 23 parents`.
>
> She taps it and posts, tagged `Question`:
>
> > "Aarav is spending 2.5 hours on maths homework every night since the new chapter started. Is it just him or is the whole class struggling?"
>
> **8:41 AM** — 23 parents get one notification: *"New post in Gaudium School · CBSE · Grade 6"*. Grade 1 and Grade 9 parents at the same school get nothing.
>
> **9:15 AM** — Four replies. `Parent-K88T` writes: "Same here, about 2 hours. Three of us mentioned it at the last PTM." `Parent-M20V`: "We started weekend-only revision instead of daily. Helped."
>
> **9:30 AM** — Meera taps **Message parent** on that second reply to ask what exactly they changed. A private 1:1 chat opens. Still anonymous, both sides.
>
> **Outcome:** Meera got a specific, credible answer in under an hour from 23 people in her exact situation — without creating a group, naming it, or adding anyone.

### What good looks like

- A parent with school and grade filled in sees this circle without being told it exists
- Posts here get a higher reply rate than school-wide posts, because relevance is higher
- Zero duplicate circles for the same school and class

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Small schools produce circles of 2–3 parents | Show the circle but display a joining prompt instead of an empty feed until it has meaningful membership |
| School name entered inconsistently ("Gaudium", "The Gaudium School") | Parents pick from a school catalogue with fuzzy search, not free text. Unmatched entries go to a review queue |
| Section-level need ("6A only") | Not supported, and deliberately so. Section is volatile, often unknown to parents, and would fragment a working circle |

---

## 4.2 Verified tutor and institution directory, with reviews

**Layer:** Marketplace · Extends the existing provider and activity system

### How parents behave today

When Meera needs a maths tutor, she asks her apartment WhatsApp group. She gets four numbers with no context. She calls all four. Two never answer. One is too far. She has no idea whether any of them are good, what they charge, or whether they have actually taught CBSE Grade 6.

Rajesh went through the same loop three months ago for the same subject and reached a good answer. That knowledge died in a WhatsApp thread nobody can search.

### The trigger moment

A specific, time-bound need: exam term starting, a subject slipping, a child asking to learn keyboard, summer holidays approaching, a sport the school does not offer.

Parents at this moment want three things in order:

1. **Who is nearby** — within a realistic travel distance
2. **Who is legitimate** — actually qualified, actually operating
3. **Who did other parents choose, and would they choose again**

The third one is the entire value. A listing without a review is a phone number, and parents already have phone numbers.

### What Vaara provides

The app already has providers with service pin codes and published activities. This feature completes it with the parts that create trust.

| Capability | What the parent sees |
|------------|----------------------|
| Local discovery | Tutors and institutions serving their pin code, filtered by curriculum and grade |
| Verification badge | Documents checked by the Vaara team — not self-declared |
| Ratings and reviews | Written by parents, with an attendance signal where the app can confirm it |
| Fee transparency | Published fee range, so nobody wastes a call |
| Reminders | A saved activity produces a reminder before it starts |

**Reviews are the moat, not the listings.** Anyone can build a directory. A directory with honest, local, verified-parent reviews cannot be copied quickly.

### Simulated walkthrough

> **Saturday, 11:00 AM** — Aarav's maths test comes back at 54%. Meera decides on a tutor.
>
> **11:05 AM** — She opens **Activities**, filters `Maths · CBSE · Grade 6 · 560102`. Six results, three carrying a **Verified** badge.
>
> **Suresh Kumar — Maths, CBSE & ICSE, Grades 5–8**
> `Verified` · 4.6 ★ (11 reviews) · ₹4,000–5,000 / month · Koramangala 560102
>
> Top review, from a parent shown only as `Parent-R55X · CBSE · G6`:
>
> > "Took him for two terms. Very patient with concepts, gives weekly progress notes. Batch of 6 so not fully one-on-one — worth knowing before you join."
>
> **11:12 AM** — That last sentence is what she needed. She saves the listing and sets a reminder for the trial class on Monday.
>
> **11:14 AM** — She cross-checks by posting in her **560102** circle: "Anyone here used Suresh Kumar for CBSE maths?" Two parents confirm within the hour, one adds that he is strict about attendance.
>
> **Following month** — After Aarav completes four weeks, Vaara prompts Meera to review. She rates 5★ and writes what changed. Her review now helps the next parent, and her identity stays `Parent-7F2A`.

### What good looks like

- Parents filter to a shortlist of two or three, not a list of twenty
- Reviews mention **specifics** — batch size, teaching style, punctuality — not just "good teacher"
- A meaningful share of listings carry a verification badge; unverified ones are visibly distinct
- Providers begin inviting their own existing parents onto the platform

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Fake five-star reviews from the provider's own network | Prefer reviews from parents with a saved activity or set reminder; label these differently from unverified reviews. Rate-limit reviews per parent per provider |
| A single angry parent destroys a good tutor's rating | Require a minimum review count before a public average is shown. Give providers one public right of reply per review |
| "Verified" becomes meaningless | Verification is a manual document check by the Vaara team, with a recorded reviewer and date. Never automatic, never self-declared |
| Reviews turn into a dispute channel | Reviews describe the service, not people. Reported reviews go to the existing moderation queue |
| Provider goes inactive but stays listed | Listings require periodic reconfirmation; stale listings drop out of discovery |

---

## 4.3 Polls in posts

**Layer:** Identity (rides on circle posts) · Smallest build, largest engagement return

### How parents behave today

Meera wants to know how much other Grade 6 parents pay for tuition. She asks in the WhatsApp group. Three parents reply with amounts, six read it and stay silent because typing a number in front of 180 people feels like disclosing income. She gets three data points and no confidence.

The barrier is not interest. It is that answering costs visible effort and reveals something about you.

### The trigger moment

Any question with a small, known set of answers: fee ranges, transport choices, screen time limits, tuition or no tuition, board preference, whether other people are also seeing a problem.

### What Vaara provides

A poll attached to a circle post. One tap to answer. Results shown as counts. The individual vote is never attributed to a handle.

| Property | Behaviour |
|----------|-----------|
| Cost to answer | One tap |
| Attribution | Aggregate only — nobody sees who voted for what |
| Reach | Same circles as the post, including multi-circle posts |
| Result visibility | Author chooses: visible immediately, or only after voting |

Polls work because they convert **lurkers into participants**. A parent who would never write a reply will still tap an option, and that single tap gives the asker a real distribution.

### Simulated walkthrough

> **Wednesday, 9:00 PM** — Meera posts in `Gaudium School · CBSE · Grade 6` with a poll:
>
> > "How much are you paying per month for maths tuition?"
> > ◦ Under ₹3,000 ◦ ₹3,000–5,000 ◦ ₹5,000–8,000 ◦ Above ₹8,000 ◦ No tuition
>
> **9:00–11:00 PM** — 19 of 23 parents vote. Only two write a comment.
>
> ```
> Under ₹3,000      ██                 2
> ₹3,000–5,000      ████████████       12
> ₹5,000–8,000      ███                3
> Above ₹8,000      ▌                  0
> No tuition        ██                 2
> ```
>
> **11:05 PM** — Meera now knows Suresh Kumar's ₹4,000–5,000 sits squarely in the normal band. She stops second-guessing the price.
>
> **Contrast:** the same question in WhatsApp produced three replies. Here it produced nineteen, because voting is anonymous and costs one tap.

### What good looks like

- Poll posts get several times the response rate of text-only posts
- Parents who never post still vote — participation broadens beyond the vocal minority
- Sensitive topics (fees, income-adjacent, screen time) get honest distributions

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Polls used to pressure or shame ("who has not paid the trip fee") | Reportable like any post; poll options are moderated content |
| Vote changed repeatedly to skew counts | One vote per parent per poll, changeable until the poll closes, counted once |
| Poll fatigue crowding out real discussion | Cap active polls per parent per day; polls expire and become read-only |
| Author identifies voters from a tiny circle | In very small circles, withhold results until a minimum number of votes exist |

---

## 4.4 Community marketplace — buy, sell, give away

**Layer:** Marketplace · Scoped to apartment community and pin code

### How parents behave today

Anitha has Diya's Grade 4 textbooks, an outgrown school uniform, and a cycle in the loft. She posts a photo in the apartment WhatsApp group. Two people ask "still available?" three weeks later, after she has given it away. The message scrolled past everyone who actually wanted it.

Meanwhile Meera is buying the same Grade 4 books new, from a shop, at full price, in the same building.

### The trigger moment

Strongly seasonal and predictable:

| Time of year | What moves |
|--------------|-----------|
| Academic year start | Textbooks, uniforms, shoes, stationery, bags |
| Term breaks | Cycles, sports gear, board games, musical instruments |
| Growth spurts | Uniforms, shoes, sports kit — continuously |
| Relocation | Furniture, appliances, everything |

School items have a property that makes this work unusually well: **the buyer and seller need to be at the same school**, and they already are.

### What Vaara provides

Listings scoped to the parent's community and pin code, with an explicit "give away free" option.

| Capability | Behaviour |
|------------|-----------|
| Scope | Own apartment community first, then pin code — never city-wide |
| Types | For sale, free to a good home, wanted |
| Categories | Textbooks, uniforms, sports, instruments, toys, furniture, other |
| Contact | In-app 1:1 chat, still anonymous until both sides choose otherwise |
| Lifecycle | Marked sold, or auto-expires after a set period |

This is the feature that gives parents a reason to open the app **when they have no question to ask**. Circles are episodic; the marketplace is recurring.

### Simulated walkthrough

> **Sunday, 10:00 AM** — Anitha lists three items in Green Valley Apartments:
>
> 1. `CBSE Grade 4 textbook set — ₹400 — good condition`
> 2. `Gaudium uniform, size 8, 2 sets — Free`
> 3. `Kids cycle, 16 inch — ₹1,200`
>
> **10:02 AM** — Green Valley parents are notified. Grade 4 parents at Gaudium also see it surfaced in their school circle.
>
> **10:20 AM** — Meera sees the uniform. Aarav is size 8. She messages `Parent-D41E`: "Is the uniform still available? Aarav is in Grade 6 but same size."
>
> **10:25 AM** — Anitha replies yes. Now they need to actually meet, and here anonymity stops being helpful:
>
> > Vaara prompts both: **"Share first name and flat number to arrange handover?"**
> > Both tap **Share**.
> >
> > Meera now sees: *Anitha · B-704*
> > Anitha now sees: *Meera · C-1203*
>
> **10:40 AM** — Handover done. Nothing was posted publicly; the reveal was mutual, scoped to this one conversation, and logged.
>
> **10:45 AM** — Anitha marks the uniform **Given away**. It disappears from the listing feed.

### What good looks like

- Repeat listings from the same parents — the sign it became a habit
- Free items move within hours
- Chats convert to completed handovers, and listings actually get closed out
- Marketplace visits do not need a notification to trigger them

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Commercial sellers flooding the feed | Listing caps per parent per week; repeat-volume patterns flagged for review |
| Prohibited items (medicines, weapons, baby car seats past expiry) | Explicit prohibited list shown at listing time; reportable |
| A meetup goes badly | Handover happens inside the community, both identities are disclosed and logged, and reports link the conversation. Vaara does not handle payments and says so |
| Stale listings making the feed feel dead | Auto-expiry with a "still available?" prompt to the seller |
| Anonymous handles making handover impossible | Solved by graduated disclosure — see section 6 |

---

## 4.5 School reviews and fee transparency

**Layer:** Marketplace · Highest-intent behaviour in the entire product

### How parents behave today

Fatima is relocating from Hyderabad in two months and has to choose a school with almost no information. She searches "best CBSE schools Koramangala", lands on aggregator pages with paid rankings, then joins three Facebook groups to ask the same question hundreds of parents have already asked.

What she actually wants to know is not on any website: what is the **real** annual cost including transport and books, how often fees rise, whether the school responds to parents, and how the transition goes for a mid-year joiner.

The parents who know are sitting in Vaara's school circles.

### The trigger moment

| Trigger | Urgency |
|---------|---------|
| Relocating to a new city | Very high — deadline driven |
| Admission season | Very high — annual, concentrated |
| Considering a switch | High — usually triggered by a specific grievance |
| A fee hike letter arrives | Immediate — parents want to know if it is normal |
| Choosing a board (CBSE / ICSE / IB / State) | High, and decided years before admission |

### What Vaara provides

| Capability | Detail |
|------------|--------|
| School profile | Board, grades offered, location, transport, language options |
| Parent reviews | From parents whose child attends or attended — the credibility anchor |
| Fee reality | Reported ranges including the extras: transport, books, uniform, activities |
| Fee history | How much fees rose year on year, as reported by parents |
| Ask current parents | A question routed to that school's circle, answered by people actually there |
| Comparison | Two or three schools side by side |

Two design decisions matter here. **Reviewers stay anonymous** — a parent will not honestly review the school their child currently attends under their real name. And **fee data is reported, not scraped**, so it must always be labelled as parent-reported with a date.

### Simulated walkthrough

> **Thursday, 9:00 PM** — Fatima, still in Hyderabad, opens Vaara and searches schools in 560102.
>
> **Gaudium School — Koramangala**
> CBSE · Grades 1–12 · 4.2 ★ (18 parent reviews)
> Parent-reported annual cost: **₹1.85L – ₹2.1L** including transport and books
> Reported fee increase last year: **~8%**
>
> Review from `Parent-7F2A · CBSE · G6`:
>
> > "Strong on academics and the teachers respond on email within a day. Fees go up around 8% every year, so budget for that. Transport is reliable but the Koramangala route is long — factor 45 minutes each way."
>
> **9:20 PM** — She still has a question no review covers. She taps **Ask current parents**: *"How hard is it for a child joining in Grade 4 mid-year to settle in?"*
>
> The question lands in the Gaudium school circle. Fatima is not a member — she gets the answers without gaining access to the internal feed.
>
> **Next morning** — Three replies, including one from a parent who joined mid-year two years ago describing exactly how the first month went.
>
> **Two months later** — Fatima has moved, Gaudium is confirmed, and her profile now places her in the Gaudium school circle, the CBSE Grade 4 class circle, and 560102. She is now the person who answers the next Fatima.

### What good looks like

- Parents who have not yet chosen a school still find the app useful — this is the entry point for people with no circle yet
- Fee ranges converge as more parents report, becoming genuinely predictive
- "Ask current parents" gets answered within a day
- New joiners convert into circle members automatically once their child profile is complete

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Schools posting fake positive reviews | Reviews require a linked child profile at that school. Suspicious clusters flagged |
| Defamatory reviews about named teachers | Reviews cover the institution, not named staff. Named-individual complaints are removed and routed to moderation |
| Fee data going stale and misleading | Every figure carries a reported-on date; old data decays out of the displayed range |
| Schools demanding removal of honest reviews | Published policy: factual parent experience stays. Right of reply offered. Defamation and named-individual attacks removed |
| Non-parents mining the platform for lead generation | School review browsing is open, but circle feeds and "ask current parents" require a verified parent account |

---

# Tier 2 — Depth and retention

Seven features that make the app worth returning to once the core loop works. Build after Tier 1, because each of these needs existing content or existing density to be useful.

---

## 5.1 Curated interest topics

**Layer:** Interest · The answer to "can parents create their own groups"

### How parents behave today

Meera's screen-time problem has nothing to do with her school, her pin code, or her apartment. It is about a nine-year-old and a tablet. She wants other parents wrestling with the same thing, and they are spread across every school and locality.

Left to create groups themselves, parents produce `#ScreenTime`, `#screen-time`, `#ControllingScreenTime` and `#NoPhonesAtDinner` within a week — four rooms, each with a handful of members and two posts. Everyone concludes the app is empty.

### The trigger moment

A concern tied to the **child's stage or behaviour**, not to geography: screen time, picky eating, exam stress, sleep, tantrums, teen behaviour, learning differences, pregnancy and infant care, choosing a board.

### What Vaara provides

Topics are **labels on posts, not separate rooms**. A parent tags a post with a topic; the topic feed collects every post carrying that tag from every circle the reader is allowed to see.

| Property | Behaviour |
|----------|-----------|
| Catalogue | Curated by Vaara — around 40–60 topics at launch |
| Created by | Vaara. Parents **request** new topics; requests are reviewed and merged |
| Used by | Tagging a post, following a topic |
| Feed content | Aggregated across circles — full on day one, never empty |
| Visibility | A reader only ever sees posts from circles they belong to |

This is the crucial difference. A room for `#ControllingScreenTime` inside one school would hold two posts. As a label across every circle, it holds hundreds immediately.

```
Meera's post lives in:   Gaudium CBSE G6 circle  +  560102 circle
                                     │
                         tagged:  #screen-time
                                     │
          #screen-time feed  =  every tagged post the reader may see
```

**Promotion rule:** a topic that crosses a real threshold — sustained posting and a few hundred followers in one city — graduates into a proper circle with its own feed and membership. Rooms are earned, not handed out.

### Simulated walkthrough

> **Monday, 10:00 PM** — Meera writes a post and taps **Add topic**. She types "screen" and the catalogue offers `Screen time & devices`. She selects it.
>
> Her post now sits in her Gaudium Grade 6 circle, her 560102 circle, and carries the screen-time topic.
>
> **10:01 PM** — She taps the topic name out of curiosity. The feed already holds 140 posts from parents across schools and localities she is connected to — including a thread from eight months ago where fourteen parents compared what actually worked.
>
> **10:20 PM** — She follows the topic. New posts under it now appear in a digest, not as individual push notifications.
>
> **Two weeks later** — She requests a new topic, `Sibling rivalry`. Vaara reviews it, finds no near-duplicate, and adds it to the catalogue. Every parent benefits from one clean topic instead of five spellings.

### What good looks like

- A brand-new topic still shows content immediately, because the label applies retroactively
- Topic requests trend toward genuinely new subjects, not restatements
- Parents discover useful posts from outside their own circles without breaching visibility rules

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Near-duplicate topic requests | Reviewed and merged into a canonical topic with aliases |
| Topics used to leak posts across circles | Topic feeds filter strictly by the reader's circle membership. A topic never widens visibility |
| Over-tagging to farm reach | Cap topics per post to two or three |
| Medical or legal advice in sensitive topics | Sensitive topics carry a standing disclaimer and are prioritised in moderation |

---

## 5.2 Saved posts

**Layer:** Cross-cutting utility · Smallest build in the document

### How parents behave today

Rajesh reads a genuinely useful thread about IGCSE subject selection at 11 PM. Three weeks later, when the decision is actually due, he cannot find it. He scrolls, gives up, and asks the question again — which the circle has now answered twice.

### The trigger moment

Reading something useful **before** it is needed. Almost all high-value parenting information is consumed early and acted on later: admissions timelines, tutor recommendations, exam strategies, fee comparisons.

### What Vaara provides

A save action on any post, listing, or activity, with a personal saved list. Private — nobody sees what another parent saved, and there is no public save count.

### Simulated walkthrough

> **Late night** — Rajesh saves a thread titled *"IGCSE subject combinations — what we learned choosing for Grade 9"*.
>
> **Three weeks later** — He opens **Saved**, finds it in one tap, and re-reads the two replies that mattered.
>
> **Same evening** — He adds a reply of his own from his experience. The thread is now more valuable than when he saved it, and the circle did not have to answer the same question a third time.

### What good looks like

- Saved items are actually revisited, not just hoarded
- Repeat questions in circles decline
- Saved lists become a personal reference parents return to during decision windows

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Saved list becomes an unusable dump | Group by type, allow removal, surface a gentle prompt for very old saves |
| Saved post is later deleted or moderated | Show a neutral placeholder rather than a broken entry |

---

## 5.3 School calendar

**Layer:** Identity (attached to school circles) · The weekly-habit hook

### How parents behave today

The PTM date was announced in a WhatsApp message on a Tuesday afternoon. Meera saw it, meant to note it down, and did not. She finds out she missed it when another parent mentions it. The exam schedule is a photo of a printed notice, sent twice, with a correction in between that half the group never saw.

Parents keep this in their heads, in screenshots, and in a paper diary — and they miss things.

### The trigger moment

Any dated school event: exams, PTM, holidays, fee due dates, sports day, submission deadlines, uniform days.

### What Vaara provides

| Capability | Behaviour |
|------------|-----------|
| Calendar view | Dated events for the parent's school, filtered to their child's grade where relevant |
| Sources | Vaara-entered for verified schools; parent-contributed entries clearly marked as unconfirmed |
| Reminders | Uses the existing reminder system — a nudge before the event |
| Corrections | Parents can flag a wrong date; corrections are reviewed and the entry updated once |

The strategic value is rhythm. Circles are episodic — a parent posts when they have a problem. A calendar gives a reason to open the app **every week**, which is what keeps push notifications welcome rather than annoying.

### Simulated walkthrough

> **Monday** — Vaara adds *PTM — Grade 6 — Saturday 14th, 9:00–11:30 AM* to the Gaudium calendar.
>
> Meera gets one notification. She taps **Remind me** and picks the evening before.
>
> **Friday 13th, 7:00 PM** — Reminder fires. She confirms her slot with the school and prepares two questions from the maths homework thread she saved.
>
> **Saturday 14th** — She attends, raises the syllabus-pace issue with the class teacher, and afterwards posts a short summary in the Grade 6 circle for the parents who could not attend.
>
> **Outcome:** the calendar prevented a miss, and it fed content back into the circle.

### What good looks like

- Weekly opens driven by the calendar, independent of push notifications
- Very few missed PTMs and deadlines among active parents
- Post-event summaries appearing in circles, turning a date into a discussion

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Wrong dates causing a real miss | Unconfirmed entries are visually distinct from verified ones and never trigger confident reminders |
| Calendar treated as authoritative over the school | Persistent line: confirm with the school. Vaara is a convenience layer, not the source of record |
| Sparse calendars making the feature feel broken | Only surface the calendar for schools with a minimum level of populated data |

---

## 5.4 Local recommendations — pediatricians, dentists, therapists

**Layer:** Marketplace · Very high intent, highest care required

### How parents behave today

Anitha's toddler spikes a fever at 9 PM on a Sunday. She needs a pediatrician who is nearby, open, and good with small children — right now. She calls two friends and searches a maps app that shows ratings from people who are not parents and may not have been patients at all.

Three months later she needs a pediatric dentist and starts from zero again.

### The trigger moment

| Trigger | Urgency |
|---------|---------|
| Sudden illness | Immediate |
| Routine vaccination or check-up | Planned |
| Speech, occupational or learning-support referral | Considered, often anxious, heavily research-driven |
| Dental, vision, orthodontics | Planned |

### What Vaara provides

Parent-recommended local practitioners, scoped to pin code, categorised by specialisation, with plain-language notes about what the visit was actually like.

| Capability | Behaviour |
|------------|-----------|
| Discovery | By pin code and category |
| Recommendation | From a parent who actually visited, kept anonymous |
| Practical notes | Waiting time, whether they are good with anxious children, consultation fee range, appointment reality |
| Explicit boundaries | No diagnoses, no treatment discussion, no medicine names |

**This feature carries the highest liability in the product, so its scope is intentionally narrow:** parents recommend *who to see*, never *what to do*. Every symptom or treatment question is redirected to a professional.

### Simulated walkthrough

> **Sunday, 9:00 PM** — Anitha opens **Local recommendations**, filters `Pediatrician · 560102`.
>
> Four practitioners, sorted by how many parents in her area recommended them. The top entry carries a note from `Parent-M20V`:
>
> > "Very calm with toddlers, evening slots until 9 PM, consultation around ₹700. Waiting time can hit 40 minutes on weekends — call ahead."
>
> **9:05 PM** — Exactly the practical detail she needed. She calls ahead and goes.
>
> **Monday** — Vaara asks whether the visit was useful. She adds her own note. A banner reminds her: describe the practice, not the diagnosis.
>
> **Attempted misuse** — Later that week she starts typing "his fever came back after 3 days, should I give…". The app interrupts with a clear message: Vaara cannot help with symptoms or medication; contact your pediatrician. The post is not published.

### What good looks like

- Parents find a nearby, parent-vetted practitioner in a single session
- Recommendations describe logistics and manner, not medical outcomes
- Symptom and medication discussion is consistently blocked before publishing

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Medical advice between parents | Content rules enforced at composition time, plus prioritised moderation. Symptom and medication posts blocked |
| A recommendation leading to a bad outcome | Prominent, permanent disclaimer. Vaara surfaces parent opinion and never endorses |
| Practitioners soliciting recommendations | Practitioners cannot write or edit entries; volume patterns flagged |
| Sensitive categories (therapy, special needs) exposing a child's condition | These categories default to extra-private handling: no child context label attached to the recommendation |

---

## 5.5 Expert sessions — scheduled Q&A

**Layer:** Interest · Trust and rhythm

### How parents behave today

Meera has a question about Aarav's concentration that she does not want to ask other parents, because it feels like admitting a problem. Searching produces contradictory advice, a paywalled clinic page, and an alarming forum thread. She does nothing.

### The trigger moment

A question that is **beyond peer knowledge** — development, behaviour, nutrition, learning differences, adolescence, exam anxiety — where parents want a professional but not yet an appointment.

### What Vaara provides

Scheduled, time-boxed sessions with a named professional. Parents submit questions in advance or live; the expert answers publicly; the thread stays readable afterwards.

| Property | Behaviour |
|----------|-----------|
| Expert | Named, credentials shown, verified by Vaara |
| Parent | Anonymous — this is what makes hard questions askable |
| Format | Announced ahead, runs for a fixed window, questions upvoted so the best get answered |
| Afterlife | Archived and searchable — one session serves parents for months |

The anonymity asymmetry is the whole feature. A named professional answering an anonymous parent is exactly the safety a parent needs to ask about something they are worried about.

### Simulated walkthrough

> **Monday** — Vaara announces: *Dr. Kavya Rao, Pediatrician — Thursday 8–9 PM — Concentration, sleep and screen habits in 8–12 year olds.*
>
> **Tuesday** — Meera submits, as `Parent-7F2A`: "My 11-year-old cannot sit through 20 minutes of homework but will focus on a game for two hours. Is that a concentration problem or a motivation problem?"
>
> Her question gets 34 upvotes — the highest of the session. Thirty-four parents were quietly wondering the same thing and none had asked.
>
> **Thursday, 8:12 PM** — Dr. Rao answers it first, publicly, in plain language, with a clear line on when it would be worth a formal assessment.
>
> **8:40 PM** — Meera asks a follow-up in the thread. Still anonymous.
>
> **Six weeks later** — Fatima, newly arrived, searches "concentration" and finds the archived session. One hour of an expert's time is still working.

### What good looks like

- Upvote counts reveal which worries are widespread but unspoken
- Archived sessions keep generating reads long after the live window
- Parents ask harder, more honest questions than they would in a circle

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Session becomes a sales pitch | Experts agree to no-promotion terms; a clinic link is allowed only in their profile |
| Individual medical advice given publicly | Experts answer at the general level and explicitly redirect individual cases to consultation |
| Low attendance making it feel empty | Advance question submission means the archive has value even with light live attendance |
| Unqualified "experts" | Manual credential verification, same standard as provider verification |

---

## 5.6 Playdates and same-age connections

**Layer:** Identity · Genuine need, highest safety bar of any Tier 2 feature

### How parents behave today

Anitha's toddler has no one to play with. There are certainly other three-year-olds in Green Valley Apartments, but she has no way to find them without knocking on doors or posting something in a WhatsApp group that feels like an intrusion.

For younger children this is one of the most acute unmet needs in urban parenting, and it is almost entirely unserved.

### The trigger moment

| Trigger | Typical age |
|---------|-------------|
| Only child with no nearby peers | 2–8 |
| New to the building or city | Any |
| School holidays with nothing to do | 4–12 |
| A shared interest with no local group | 6–14 |

### What Vaara provides

Opt-in matching by child age band and locality, always initiated as a **parent-to-parent conversation** — never child-to-child, and never a public listing of children.

| Property | Behaviour |
|----------|-----------|
| Opt-in | Off by default. A parent explicitly enables playdate matching |
| Matching on | Child age **band** (not date of birth), community or pin code |
| Never exposed | Child name, school, photo, exact address |
| Initiation | Anonymous parent-to-parent chat |
| Meeting | Public or common areas suggested; identity disclosure required before arranging |

Every design choice here is subtractive. The feature is deliberately less capable than it could be, because the downside risk is a child's safety rather than a bad purchase.

### Simulated walkthrough

> **Saturday** — Anitha enables playdate matching for her three-year-old: age band `2–4`, scope `Green Valley Apartments`.
>
> She sees: *4 parents in Green Valley with a child aged 2–4*. No names, no children, no flat numbers.
>
> **Saturday, 4:00 PM** — She messages one: "Hi, my little one is 3 and has nobody to play with in the building. Would you be up for meeting at the park downstairs sometime?"
>
> **4:30 PM** — `Parent-J17R` replies yes. Before they can fix a time, Vaara requires disclosure:
>
> > **"Meeting in person? Both parents should share first name and flat number."**
> > Both accept. Anitha sees *Priya · A-302*.
>
> **Sunday, 5:00 PM** — They meet at the children's park in the complex. Two three-year-olds now have someone to play with, and two parents have met a neighbour.
>
> **What never happened:** no child's name, age in months, photo, or school was visible at any point to anyone who had not been mutually accepted.

### What good looks like

- Matches convert into actual meetings in shared public spaces
- No child-identifying information is ever exposed to an unmatched parent
- Disclosure is mutual and logged before any meeting is arranged

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Bad actors seeking access to children | Opt-in only; parent-to-parent only; mutual disclosure before meeting; report and block prominent; matching restricted to verified parent accounts with a complete profile |
| Child details leaking | Age **bands** only, never exact age or date of birth. No child names or photos anywhere in matching |
| A meeting going wrong | Public and common-area meetings recommended in-product; both identities disclosed and logged; reports link the conversation |
| Feature appearing empty | Only surface it where enough opted-in parents exist in that community or pin code |

---

## 5.7 Carpool coordination

**Layer:** Identity · The stickiest Tier 2 feature, and the one that cannot be anonymous

### How parents behave today

Meera drives Aarav to Gaudium every morning. Three other children from Green Valley go to the same school at the same time in three separate cars. Everyone knows this is absurd. Nobody organises it, because organising it means trusting strangers with your child and negotiating a schedule over WhatsApp with people you have never met.

### The trigger moment

| Trigger | Frequency |
|---------|-----------|
| Daily school run | Every weekday, permanent |
| After-school coaching in the same direction | Weekly |
| A one-off — car in the workshop, parent travelling | Occasional but urgent |
| School bus route cancelled or rerouted | Sudden, high stress |

### What Vaara provides

Matching on the two attributes that make carpooling possible — **same school** and **same locality** — with mandatory identity disclosure before any arrangement is confirmed.

| Capability | Behaviour |
|------------|-----------|
| Match on | Same school circle plus same community or pin code |
| Declared | Direction, timing, days, seats available or needed |
| Identity | **Full disclosure required** — name, flat, vehicle, phone — before confirmation |
| Coordination | Group arrangement between parents who have already disclosed |
| Position | Vaara introduces and records; parents arrange between themselves |

Once four families share a school run, they open the app every single day. Nothing else in the product produces that frequency. It is also the feature where anonymity must be fully abandoned, and that has to be explicit rather than gradual.

### Simulated walkthrough

> **Monday, 9:00 PM** — Meera opens **Carpool** and declares: *Green Valley → Gaudium School, 7:30 AM weekdays, 2 seats available*.
>
> **9:02 PM** — Three Green Valley parents with children at Gaudium are notified.
>
> **9:30 PM** — `Parent-K88T` responds. They chat anonymously about timing and route.
>
> **Tuesday, 8:00 PM** — They want to commit. Vaara blocks confirmation until both complete **full disclosure**, with an explicit screen:
>
> > **Carpooling requires full identity.** Anonymous carpooling is not permitted.
> > You will share: name, flat number, phone, vehicle details.
> > This cannot be undone for this arrangement.
>
> Both accept.
>
> > Meera sees: *Sanjana · C-908 · 98••••4412 · White Baleno KA-01-••-2290*
> > Sanjana sees: *Meera · C-1203 · 99••••7781 · Grey i20 KA-05-••-6634*
>
> **Wednesday, 7:30 AM** — Shared run begins. They alternate weeks.
>
> **Two weeks later** — Two more families join. Four families, one arrangement, and every one of them opens Vaara daily.

### What good looks like

- Arrangements persist for months, not days
- Daily active use among participating parents, with no notification needed
- Disclosure is complete and explicit — never partial, never implied

### Failure modes and guardrails

| Risk | Handling |
|------|----------|
| Child safety with an unknown driver | Full mandatory disclosure, matching restricted to same school and same locality, verified parent accounts only, reports prominent throughout |
| Vaara being treated as a transport service | Stated plainly: Vaara introduces parents and records the arrangement. It does not vet drivers, insure rides, or track vehicles |
| A parent silently dropping out | Arrangements have explicit participants and a visible exit; leaving notifies the group |
| Money disputes over fuel sharing | Out of scope. No payments in the product; parents settle directly |
| Anonymity expectations carried over from circles | A distinct, unmissable disclosure gate. Carpool is the one feature that is never anonymous |

---

# 6. The trust problem

The single hardest design issue in the product. It deserves its own section because it cuts across half the features above.

---

## 6.1 What the problem actually is

Anonymity is the reason Vaara works and the reason several features cannot work.

**Anonymity is essential for asking.** A parent will only ask these honestly when nobody knows who they are:

- "Is this fee hike normal or are we being taken advantage of?"
- "My child was singled out by a teacher — has anyone else had this?"
- "I think my daughter has a learning difficulty and I don't know where to start."
- "We cannot afford the trip. Did anyone else opt out?"

Under a real name, in a group containing the school's own parent body, none of these get asked. They get swallowed. **The anonymous handle is the product's core value.**

**Anonymity breaks completely for meeting.** These are impossible without knowing who the other person is:

| Situation | Why anonymity fails |
|-----------|--------------------|
| Handing over a uniform | Someone has to come to a door |
| Selling a cycle | Money and a physical meeting |
| A playdate | A child goes to a stranger's home or a park |
| A carpool | A child gets into a stranger's car |

So the product needs both, in the same app, without letting one destroy the other.

**The wrong solutions:**

| Approach | Why it fails |
|----------|--------------|
| Everyone anonymous, always | Marketplace, playdates and carpool become unusable. Half of Tier 1 and Tier 2 collapse |
| Everyone real-name, always | The honest questions stop. The core value evaporates |
| Optional profile-wide toggle | Social pressure makes it effectively mandatory. Parents who stay anonymous look suspicious, which is the same as having no anonymity |

---

## 6.2 The solution — graduated disclosure

Identity is revealed **per relationship, mutually, and only as far as the situation requires.** Never globally, never one-sided, never permanently for the whole account.

```
LEVEL 0   Circle feed          Parent-7F2A · CBSE · G6
          always anonymous     ← honest questions live here

LEVEL 1   1:1 chat opened      Parent-7F2A
          still anonymous      ← follow-up conversation

LEVEL 2   Transaction          Meera · C-1203
          mutual opt-in        ← marketplace handover, playdate

LEVEL 3   Ongoing trust        Meera · C-1203 · 99••••7781 · Grey i20
          explicit, logged     ← carpool only
```

### The rules

| Rule | Reason |
|------|--------|
| **Mutual** — one parent's reveal only takes effect when the other also reveals | Prevents one-sided extraction of identity |
| **Scoped** — disclosure applies to one conversation, not the account | Revealing to a carpool partner must not reveal you in your school circle |
| **Purposeful** — always triggered by a real need (handover, meeting, ride) | Parents accept disclosure when the reason is obvious |
| **Logged** — every disclosure records who, what, when, and why | Essential for moderation and dispute handling |
| **Irreversible within scope** — you cannot un-see a revealed name | So the prompt must state exactly what is being shared before consent |
| **Level 3 is opt-in and unmissable** | Carpool involves a child in a vehicle. It requires a distinct screen, not a toggle |

### What each level exposes

| Level | Shared | Never shared |
|-------|--------|--------------|
| 0 | Anonymous handle, curriculum, grade | Name, child name, flat, phone, email |
| 1 | Same as level 0 | Same as level 0 |
| 2 | First name, flat or block | Phone, email, child name, exact address |
| 3 | Name, flat, phone, vehicle | Email, child name, workplace |

**Child identity is never disclosed at any level.** Not at level 3, not in carpool, not in playdates. Parents coordinate as parents. A child's name, photo and exact age stay private to their own parent throughout the product.

---

## 6.3 How this plays out — one parent, three relationships, same evening

> **8:00 PM — Level 0.** Meera posts in the Gaudium Grade 6 circle: *"Has anyone else been told the annual trip is now compulsory? We were planning to opt out."*
>
> Twenty-three parents see `Parent-7F2A · CBSE · G6`. Nobody knows it is Meera. She would not have posted this under her name, in a circle that contains parents she meets at the school gate.
>
> **8:20 PM — Level 1.** A parent replies that they opted out last year. Meera opens a 1:1 chat to ask how the school reacted. Both remain anonymous. The conversation is candid precisely because of that.
>
> **8:45 PM — Level 2.** Separately, Meera messages `Parent-D41E` about the free uniform. To arrange handover, both tap **Share first name and flat**. She becomes *Meera · C-1203*; Anitha becomes *Anitha · B-704*. This disclosure exists **only inside this conversation**.
>
> **9:10 PM — Level 3.** In the carpool thread, Meera and Sanjana confirm a shared school run. Vaara presents the full-disclosure screen. Both accept and exchange name, flat, phone and vehicle.
>
> **The critical property:** at 9:15 PM Meera returns to the Grade 6 circle. Her trip post is still signed `Parent-7F2A`. Anitha and Sanjana both know her real name — and neither can connect it to that post. Three different levels of trust, three different relationships, one unbroken anonymous identity in the feed.

---

## 6.4 Residual risks we cannot fully eliminate

Honesty matters more than reassurance here.

| Risk | Mitigation | Residual exposure |
|------|-----------|-------------------|
| **Self-identification** — a parent writes enough detail to be identified ("my son in 6B who broke his arm last week") | Warn at composition when a post contains highly identifying patterns | Cannot be prevented. Parents can always out themselves |
| **Small-circle inference** — in a circle of five, context labels narrow it down | Withhold aggregate results and member context below a minimum circle size | Real and permanent in small circles |
| **Cross-referencing** — a parent who disclosed at level 2 may recognise writing style or details in the feed | Disclosure is scoped and not linked to feed identity | Cannot be eliminated |
| **Screenshots** — anything visible can be captured and shared outside the app | Terms prohibit it; reports acted on | No technical prevention |
| **A disclosed contact misuses the information** | Block, report, and a full disclosure log for investigation | Real. Level 3 exists precisely because carpool warrants the highest bar |

**What we commit to instead of perfect anonymity:** identity is never revealed without explicit mutual consent, disclosure is always scoped to one relationship, every disclosure is logged, and a child's identity is never part of any disclosure.

---

# 7. Notification behaviour — a cross-cutting constraint

Every feature in this document adds a reason to notify a parent. Left unmanaged, this is what kills the product.

**The failure sequence:** Meera belongs to five circles, follows four topics, watches two listings and one carpool thread. On a busy Monday she gets 40 notifications. On Tuesday she disables notifications for Vaara. On Friday she stops opening the app.

Losing push is not losing a channel. It is losing the parent.

### Rules that apply to all features

| Rule | Behaviour |
|------|-----------|
| **One event, one notification** | A post targeting three circles Meera belongs to produces **one** notification, not three |
| **Digest by default for breadth** | Topics and non-urgent circle activity arrive as a periodic digest, never per post |
| **Immediate only for direct relevance** | Direct messages, replies to your own post, disclosure requests, carpool changes, and reminders you set |
| **Per-category control** | Parents mute a single circle, a single topic, or a single listing thread without muting everything |
| **Quiet hours** | Nothing non-urgent overnight |

### What warrants an immediate notification

| Immediate | Digest | Never |
|-----------|--------|-------|
| Direct message | New posts in a circle | Someone saved your post |
| Reply to your post | New posts under a followed topic | Someone viewed a listing |
| Disclosure request or acceptance | New listings in your community | Poll vote counts changing |
| Carpool arrangement change | Topic digests | Aggregate activity summaries |
| Reminder you set | New activities in your pin code | |
| Expert session starting | School calendar additions | |

---

# 8. Summary

## Feature register

| # | Feature | Layer | Primary parent need | Tier |
|---|---------|-------|--------------------|------|
| 4.1 | School + Class circle | Identity | Reach exactly my child's cohort | 1 |
| 4.2 | Tutor & institution directory with reviews | Marketplace | Find someone local I can trust | 1 |
| 4.3 | Polls in posts | Identity | Get real numbers without exposing myself | 1 |
| 4.4 | Community marketplace | Marketplace | Pass on and pick up school items nearby | 1 |
| 4.5 | School reviews & fee transparency | Marketplace | Decide on a school with real information | 1 |
| 5.1 | Curated interest topics | Interest | Find parents facing the same stage, anywhere | 2 |
| 5.2 | Saved posts | Utility | Find that useful thread again later | 2 |
| 5.3 | School calendar | Identity | Stop missing dated school events | 2 |
| 5.4 | Local recommendations | Marketplace | Find a good pediatrician near me | 2 |
| 5.5 | Expert sessions | Interest | Ask a professional without being identified | 2 |
| 5.6 | Playdates | Identity | Find nearby children of a similar age | 2 |
| 5.7 | Carpool | Identity | Share the daily school run safely | 2 |
| 6 | Graduated disclosure | Cross-cutting | Stay anonymous while asking, be known when meeting | Required |

## Build order and why

| Order | Feature | Reason for this position |
|-------|---------|--------------------------|
| 1 | School + Class circle | Uses data already collected; completes the identity layer; immediately raises reply rates |
| 2 | Polls | Smallest build in Tier 1, largest engagement return; makes existing circles feel alive |
| 3 | Provider reviews & verification | The trust moat and the strongest reason parents recommend the app |
| 4 | Graduated disclosure | **Must land before marketplace.** Marketplace without disclosure produces stuck conversations |
| 5 | Community marketplace | Recurring reason to open the app; needs disclosure in place first |
| 6 | Saved posts | Trivial build, immediate retention benefit |
| 7 | School reviews & fees | Entry point for parents with no circle yet |
| 8 | Curated topics | Needs a body of existing posts to aggregate; empty otherwise |
| 9 | School calendar | Establishes weekly rhythm; needs per-school data effort |
| 10 | Local recommendations | High value, high care — after moderation practice is established |
| 11 | Expert sessions | Requires expert relationships and scheduling |
| 12 | Playdates | Highest safety bar; needs disclosure proven in marketplace first |
| 13 | Carpool | Highest safety bar and full disclosure; last for the same reason |

**Two dependencies that cannot be reordered:**

- **Graduated disclosure before marketplace, playdates or carpool.** Without it, every one of those features dead-ends at "we need to meet but I don't know who you are."
- **Notification consolidation before the marketplace.** The marketplace is the first feature that adds a new source of notifications, and every feature after it adds another. Layering them onto an unconsolidated pipeline will drive parents to disable push, and that is not recoverable.
