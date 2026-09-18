# Slack-style threads (decision amendment)

**Status:** Implemented in app/API, but **not release-ready**. Migration `052`
must not be applied until the fixes in
[`SLACK_STYLE_THREADS_REMEDIATION.md`](./SLACK_STYLE_THREADS_REMEDIATION.md)
are complete.
Supersedes the “wide groups = topic list only” interior in
`docs/GROUP_CHAT_MODEL.md`.

**Product language in the app:** still say *group*, *message*, *thread*,
*Guest* — do **not** say “Slack” in UI copy. This doc uses Slack only as
the interaction model.

---

## 1. What we are changing

### Before (current contract / live shape)

| Surface | Behavior |
|---|---|
| `school_class` | Linear WhatsApp-style chat |
| Wide groups (`class`, `school`, `locality`, `curriculum`, `community`) | **Topic list** — must start a `circle_threads` topic to talk; no main firehose |
| Thread | First-class **topic object** with title/body/kind |
| Home | Thread **heads** (topics), not every chat line |

### After (this decision)

| Surface | Behavior |
|---|---|
| **Every** member group | Linear **channel** first (chronological messages) |
| Thread | Side conversation **under a parent message** (Slack-style), not a separate topic board |
| Same-circle | Any member can start a thread on a channel message; other members see and reply in that thread |
| Guest | A guest (or guest-granted outsider) can participate in **that thread only**, same spirit as today’s guest thread / discovery grant |
| Home / feed | A **thread can appear as a feed/Home row**, same eligibility family as lasting messages/topics today — not only as an inbox badge |

Tight vs wide is no longer “chat vs topic list.” Wide groups still need
noise controls (what appears on Home, notifications, curriculum PIN
scope) — but the **interior** is always channel + optional threads.

---

## 2. Definitions (replace §3 thread meaning)

| Term | Meaning |
|---|---|
| **Channel message** | A line in the group’s main stream (`circle_messages` with no parent-thread, or `thread_root` marker — see §5). Everyone in the group who can open the group sees it in the channel. |
| **Thread** | Replies hanging off **one parent channel message**. Flat chronological replies under that parent (one level of nesting only). |
| **Reply in thread** | Stays in the thread. Does **not** post a new channel row (except optional “N replies” / last-reply preview on the parent). |
| **Quote / reply-to** | Optional soft pointer (`reply_to_message_id`) inside the same channel or same thread — **not** a second thread level. |
| **Guest on a thread** | Non-member (or tutor) with a grant for **that thread only**. Cannot open the full channel history or member list. |
| **DM** | Still 1:1. Starting a thread is **not** a DM. “Message author” remains the path to 1:1. |

**Rule of thumb for parents**

- Quick chat → channel message.
- Need a focused side conversation (or lasting ask that should show on
  Home) → **Start a thread** on that message (or compose a channel
  message that is immediately the thread root).

---

## 2.1 Icons (thread vs reply)

Use **icons first** (Ionicons, same family as the rest of mobile chat).
Short accessibility labels stay on the control; do not rely on long text
buttons in the message action row.

| Action | Icon | Ionicons name | Meaning |
|---|---|---|---|
| **Thread** (start or open) | stacked / branched bubbles | `chatbubbles-outline` | Side conversation under this message |
| **Thread exists** (channel badge) | same, filled when active | `chatbubbles` + count | “N replies” — tap opens thread |
| **Reply** (in-channel quote) | curved reply arrow | `arrow-undo-outline` | New channel message quoting this one (optional; not a thread) |
| **Send in thread** (composer) | send | `send` | Reply stays inside the open thread |

**Rules**

1. One **thread** icon for both “start” and “continue.” First use creates
   the thread; later uses open the same thread.
2. Show the **thread badge** under a channel message only when
   `reply_count > 0` (icon + count, optional last-reply preview).
3. **Reply** icon is only for in-channel quote-reply. Do not use the
   same icon as thread.
4. Inside the thread screen, do not offer “start another thread” on a
   reply (one level only). Quote-reply inside a thread may reuse the
   reply icon later; v1 can omit it.
5. Every icon control needs `accessibilityLabel`: e.g. “Reply in thread”,
   “3 replies”, “Reply in channel”.

**Channel message chrome (ASCII)**

```
  Raj
  Yes, for Grade 4.
  [ 💬💬 ]  3          ← chatbubbles + count (thread exists)
  [ ↩️ ]               ← arrow-undo (optional in-channel reply)

  Meera
  Uniform is house T-shirt.
  [ 💬💬 ]              ← chatbubbles only (no count → starts thread)
  [ ↩️ ]
```

**Thread screen header**

```
  ←  Thread
  (parent message preview)
  …
  [ composer ]  [ ➤ send ]
```

---

## 3. Who can create / join a thread

### 3.1 Same-circle members

- Any **current member** of the circle can:
  - post channel messages;
  - **start a thread** on a visible channel message;
  - reply inside any thread in that circle (unless muted/blocked/moderated rules say otherwise).
- Thread visibility for members = same as seeing the parent message in
  the channel (membership + not blocked + message/thread not deleted).

### 3.2 Guest questions (v1 locked decision)

Guests do **not** join circles. Anonymous handles make invite-by-name
awkward, and temporary channel membership adds unnecessary history,
member-list, unread, notification, and privacy complexity.

A parent-role account that is not a member may select **Ask this school**
on a whole-school page. This creates one thread root in that school circle
and grants the asker access to that thread only.

| Rule | Decision |
|---|---|
| Eligible target | `school` (whole-school) circle only |
| Class / grade circles | Members only; guest questions rejected |
| Who may ask | Any parent-role account; no PIN, city, or school-interest relationship required |
| What the guest can read | Their thread root and all replies in that thread |
| What the guest can write | Replies in their thread while it is open |
| Main school channel | No access |
| Other threads / member list | No access |
| Direct messages | No direct member browsing or guest-initiated DM in v1 |
| Duration | No time limit; access follows the thread/grant while open and not revoked/moderated |
| Identity | Guest-authored content displays the anonymous handle plus **Guest** badge |
| Notifications | Guest author follows the thread automatically and receives thread-reply notifications unless muted |
| Limits | Existing guest-thread daily quota, blocks, content guard, reports, and moderation apply |

The guest is never inserted into `circle_members`, the school group never
appears as one of their Messages groups, and no join/leave/expiry lifecycle
is needed. A `circle_thread_access_grants` row with
`grant_role = 'guest_author'` is the durable authorization.

Tutors/providers remain a separate `provider_responder` grant path.
Discovery/share viewers remain read-only unless explicitly granted.

Manual member-to-outsider invite/revoke UI is not required for v1.

#### Implementation contract

1. Entry point: school profile → **Ask this school**.
2. Resolve the target circle from that school and require
   `circle_type = 'school'`.
3. Require an authenticated account with the parent role. Do not require
   matching PIN, city, curriculum, grade, or school membership.
4. Create a channel root plus its thread, labelled as a guest-authored
   question for circle members.
5. Insert `circle_thread_access_grants` with
   `grant_role = 'guest_author'`, `can_reply = true`, and
   `expires_at = NULL`.
6. Auto-follow the guest author so normal thread-reply notifications reach
   them.
7. Authorize that guest only on thread GET/reply/read/follow/mute routes.
   Circle channel, other-thread, member-list, and member-DM routes continue
   to require normal circle membership.
8. Apply the existing global guest-thread quota (currently five per day),
   content guard, blocks, reporting, moderation, and thread-close rules.
9. Show **Guest** beside the author in both the school member's channel root
   and the opened thread.
10. The grant remains valid until explicitly revoked or the thread becomes
    closed/deleted/moderated. There is no timer or background expiry job.

### 3.3 Not a thread

| Intent | Use |
|---|---|
| Private talk with one parent | Members use Message author → connection → DM; guest askers stay in their thread |
| Tutor sales / offers | Tutor **channel** (Services), not a parent-group thread |
| School/clinic blast | Out of scope (directory / future labeled channel) |

---

## 4. Home / feed: threads show up like lasting messages

User requirement: **just like a message can appear in feeds, a thread can
also show up in the feed/Home.**

### 4.1 What becomes a Home / feed row

Eligible **thread roots** (parent channel messages that have a thread, or
are marked home-visible) can appear on Home as snippets — same job as
today’s thread heads / post cards:

- topic/preview text = parent message body (or title if we keep optional
  title on roots);
- subtitle = last reply preview + reply count;
- tap opens **that thread** (and for members, can offer “Also see in
  channel”).

### 4.2 What must **not** flood Home

Unchanged noise rule, restated for Slack shape:

| On Home / feed | Not on Home / feed |
|---|---|
| Thread roots with `home_visibility` in (`member`, `discoverable`) | Every channel “ok / thanks” |
| New activity on threads you authored or follow (rank boost) | Every in-thread reply as its own Home row |
| Discovery-eligible roots for non-members | Full other-school channel |
| Tutor **service** rows | Tutor spam injected into class channel bubbles |

**In-thread replies are never independent Home rows.** They only bump the
parent thread snippet’s `last_message_at` / preview.

### 4.3 Channel messages vs thread roots on Home

Optional product switch (decide at implement):

| Option | Behavior |
|---|---|
| **A (recommended)** | Only messages that **have a thread** (or were composed as “ask / lasting”) appear on Home. Plain channel chat stays Messages-only. |
| **B** | Any channel message can be `home_visibility = member` (rare; author opts in). |

Default recommendation: **A**, so Slack threads replace the old “start a
topic for Home” without turning every group into a second feed of
one-liners.

Discovery: non-members only see roots with `home_visibility =
'discoverable'` (and circle/discovery rules). Tap = that thread only.

Curriculum PIN local scope (§5.1 of group-chat model) still filters which
roots appear for curriculum circles.

---

## 5. Data model delta (vs live `circle_threads` topic objects)

Live schema treats `circle_threads` as standalone topics and
`circle_messages.thread_id` as “reply inside topic.” Slack style needs the
**parent to be a message**.

### 5.1 Target shape

```text
circle_messages
  id
  circle_id
  seq                      -- per-circle chat_seq (unchanged)
  parent_message_id null   -- NULL = channel message / thread root
                           -- NOT NULL = reply in that message's thread
  reply_to_message_id null -- optional quote within same channel/thread
  ...

-- Derived / cached on the root message (or side table):
  reply_count
  last_reply_at
  home_visibility          -- on root only
  kind / title (optional)  -- for lasting asks / migrated posts
```

Constraints:

- `parent_message_id` must reference a message in the **same** `circle_id`.
- `parent_message_id` must point at a **channel root** (`parent_message_id
  IS NULL`). No nested threads (Slack = one level).
- Guests: grants keyed by **root message id** (or keep `thread_id` as an
  alias of root message id during migration).

### 5.2 Migration of existing `circle_threads`

Existing topics (including migrated posts) become:

1. One **channel root message** (body ← thread body/title).
2. Existing `circle_messages` with that `thread_id` → set
   `parent_message_id` to the new root message.
3. Preserve grants, reads, Home visibility, `source_post_id`.

Prefer a compatibility view or keep `circle_threads.id` equal to the root
message id during transition so mobile routes
`/messages/threads/[threadId]` keep working.

### 5.3 What we stop doing

- Wide-group UI that is **only** a list of topics with no channel.
- API rule “Start a thread to talk in this group” for non–`school_class`
  circles (`isLinearCircleType` today).
- Treating thread as a separate social object with no parent message.

---

## 6. Surfaces (updated)

| Tab | Job under Slack-style threads |
|---|---|
| **Messages → group** | Opens the **channel**. Parent messages show “N replies” when a thread exists. Tap replies → thread panel/screen. |
| **Thread screen** | Flat replies under the parent message; guest/tutor badges; Message author. |
| **Home** | Snippets for **eligible thread roots** (+ tutor channels). Tap → that thread. |
| **Legacy Circles feed** | Compatibility until cutover; map cards to thread roots. |

Compose inside a group:

1. Default: send **channel message**.
2. On a message: **Reply in thread** / **Start thread**.
3. Optional: compose “Ask / lasting” that creates a root marked for Home.

---

## 7. What else we have to keep in mind

Checklist beyond the three requirements above. These are easy to get wrong
when flipping from topic-boards to Slack threads.

### Product / UX

1. **Wide-group noise** — Channel exists, but Home + push must stay
   selective or PIN/school groups become unusable.
2. **Unread** — Separate cursors: channel unread vs per-thread unread
   (Slack has both). Do not reuse old `circle_members.last_read_at` feed
   cursor.
3. **Follow / mute thread** — Authors auto-follow; others can follow a
   busy thread without watching the whole channel.
4. **Guest clarity** — Guest must never think they joined the school
   group; copy and empty states matter.
5. **Thread vs DM** — “Message author” stays private 1:1; thread stays
   multi-party in-circle (plus guests).
6. **Anonymous handles** — Same as group chat today inside channel and
   thread; real identity only via DM disclosure.
7. **Empty / thin groups** — Prompt “Start a conversation” in channel,
   not “Create a topic” as the only door.

### Access & safety

8. **Grant revocation** — Removing a guest mid-thread must disconnect
   realtime and block further reads (existing revocation rules).
9. **Blocks** — Blocked users: no channel delivery, no thread replies,
   no Home snippets from them.
10. **Moderation** — Deleting/moderating a **root** closes the thread;
    deleting a reply does not remove the root.
11. **Reports** — Report root vs report reply; keep audit on both.
12. **Share links** — Share = that thread (root + replies), not the
    whole channel.

### Feed / Home / discovery

13. **Eligibility** — `home_visibility`, discoverable, member-only,
    hidden — on the **root**, not on every reply.
14. **Curriculum local scope** — Still filter which roots appear by PIN.
15. **Ranking** — Keep buckets: followed/authored activity → own-circle
    unseen roots → discovery → services.
16. **No double counting** — One Home row per root; reply bumps the same
    row.

### Notifications

17. **Channel mention / @** → notify mentioned members.
18. **Thread reply** → notify followers + participants, not the whole
    circle (unless @everyone-style — we should not ship that).
19. **Guest** → notify only people on that thread / grant path.

### Data / API / realtime

20. **One-level only** — Enforce root-only parents in DB.
21. **Per-circle `chat_seq`** — Keep gap-free seq for channel catch-up;
    thread catch-up by `parent_message_id` + seq or reply seq.
22. **Idempotency** — Keep `client_message_id` for offline send.
23. **Realtime rooms** — Subscribe to circle channel + open thread;
    guests subscribe to thread room only.
24. **Mobile routes** — Channel screen + thread screen; deprecate “group
    = thread list” for wide types.
25. **Migration** — Map every existing `circle_threads` + replies before
    flipping UI; keep read-only post archive until validated.
26. **Provider / tutor** — Still never `circle_members`; only grants /
    guest-reply on allowed roots.
27. **Preschool / age circles** — Same Slack interior once those circle
    types exist; no special topic-board for them.

### Explicit non-goals (for this amendment)

- Nested threads (thread-of-thread).
- Making Home a firehose of every channel line.
- Auto-posting one message/thread to all circles the user belongs to.
- Replacing 1:1 DMs with threads.

---

## 8. Implementation order (suggested)

1. Lock this amendment (product sign-off).
2. Schema: `parent_message_id` on `circle_messages` (or equivalent) +
   migrate `circle_threads` → roots.
3. API: allow linear messages in all circle types; start/list thread by
   parent message; guest grants on root.
4. Mobile: channel UI everywhere; thread panel; Home snippets from roots.
5. Hide legacy topic-list interior; keep post tables read-only until
   cleanup decision.

---

## 9. Open choices (decide before coding UI)

| # | Question | Recommendation |
|---|---|---|
| 1 | Do plain channel messages ever appear on Home without a thread? | No (option A in §4.3) |
| 2 | Can you start a thread with no prior channel message (compose → root)? | Yes — create root message + open thread in one action (“Ask”) |
| 3 | Do wide groups show full channel history to all members from day one? | Yes for members; guests never open the channel |
| 4 | Keep optional title/kind on roots for migrated posts / polls? | Yes for migration parity |
| 5 | Guest group membership / pass? | **No** — one guest thread only |
| 6 | Guest geo / interest gate? | **No** — any parent-role account |
| 7 | Guest access expiry? | **No** — grant follows the thread lifecycle |
| 8 | Class/grade guest questions? | **No** — members only |

---

## 10. Status

| Item | State |
|---|---|
| Slack-style channel + one-level threads for all groups | Implemented, remediation required before release |
| Same-circle members can create/join threads | Accepted |
| Whole-school guest question (thread-only, persistent) | **Implemented** (school Ask + grant + inbox guest threads + Guest badge) |
| Class/grade guest questions | **Rejected** — members only |
| Guest geo/PIN gate | None; parent role still required |
| Guest group pass / join / expiry | **Rejected** — no group access |
| Manual invite/revoke guest UI | Not required for v1 |
| Threads can appear on Home/feed like lasting messages | Accepted (roots with replies, or titled Ask threads) |
| Topic-list-only interiors for wide groups | **Removed** — groups open as channels |
| Live code / migrations | **Blocked:** complete remediation, then apply corrected `052` and ship app/API together |
