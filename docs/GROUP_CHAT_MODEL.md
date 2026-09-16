# Group chat, Home, and Messages

Decision document. **Not implemented yet.** This is the full end-to-end
product and data contract.

**UI for this model is new. Existing post/feed tables and APIs are retained
while their data is migrated into single-circle threads.** After migration
and validation, the old Home feed, circle-feed, and post-composer screens are
removed from navigation. The old tables are not dropped in the same release;
they become read-only compatibility/archive data until a separate cleanup
decision. Chat does not depend on destructive deletion.

Related (source of truth for legacy **post behavior before migration**):
`docs/POST_DISPLAY_LOGIC.md`,
`docs/POST_COMPOSER_CIRCLES_AND_INTERESTS.md`,
`docs/POST_ACCESS_AND_SHARING_IMPLEMENTATION.md`,
`docs/FEED_CIRCLE_TIMELINES.md`,
`docs/HOME_FEED_FIRST_PAINT.md`.

---

## 1. End to end (the whole product)

A parent opens **Home**. They see a **chat-format list**: snippets from
*their* groups, labeled tutor rows, and discovery snippets from groups
they do **not** belong to. They tap a row. That tap opens **that group
thread** or **that tutor channel** — never a chat room called Home.
Normal DMs stay in Messages; the Message action on a tutor/discovery row
may open or create a DM.

**Messages** is the WhatsApp-style inbox: class / school / PIN /
curriculum **groups** (the circles they belong to) + **1:1 DMs** +
**tutor channels**. The Circles tab is not a third copy of the same
groups; it **merges into Messages**.

Inside a **school-class** group they chat like WhatsApp. Inside broader
**class / school / PIN / curriculum** groups they see **threads** (topics);
replies stay in the thread so the group is not a firehose.

They type a **message** or **start a thread**. They never hit “New post”
on this surface. One-line chat stays in the group. A lasting ask
(“Which pediatrician near 502032?”) is a **thread**: it can show on Home
as a snippet; replies never become Home rows.

**Tutors / trainers / nutritionists** are not members of parent groups.
They **promote** in their own Services channel. They **answer** with a
guest reply on that one parent thread, or a tutor DM. A parent who is also
a tutor has **two DMs**: Message from the class group = parent; Message
from the tutor row = tutor.

A Gaudium parent who wants Oakridge **sees** one discovery thread or the
Schools page, **asks** via a guest thread, **talks to one parent** via
Message author → 1:1. Oakridge Grade 4 does **not** appear in their
Messages list unless they add that school on the profile.

**Schools and doctors** stay directories. They do not post into groups or
Home in this model. Parent talk *about* them is a parent thread.

**Data:** one set of **circles and members**. New canonical
**single-circle threads** and **group messages**. Existing DMs are extended
with participant presentation roles. Old posts are migrated into threads.
Every chat line is **not** a post.

---

## 2. What changes vs what does not

Single-line inventory. This is the whole model, not a slice.

### 2.1 Changes

| What | Change |
|---|---|
| **Circles tab** | No longer the front door; groups live in **Messages**. |
| **Circle interior** | School-class = WhatsApp-style **group chat**; class / school / PIN / curriculum / community = **threads**. |
| **Home (this surface)** | Chat **snippets**; tap opens that circle/thread or tutor channel. Normal DMs stay in Messages. Not a post-card feed or mega-chat. |
| **Parent compose** | **Message** or **start a thread**. No “New post” on Home/Messages chat. |
| **Unread** | Last **message / thread activity**, not “N new posts.” |
| **Interests** | Labels on threads only; not extra WhatsApp groups; still do not widen visibility. |
| **Tutors / trainers / nutritionists** | **Services channel** to promote; **guest-reply on that thread** or **tutor DM** to reply; **never** members of parent groups. |
| **Dual identity DMs** | Same human: group → **parent DM**; tutor row → **tutor DM**. Two conversations, not merged. |
| **Other school** | Discovery snippet / Schools page / **guest thread** / Message author. Full group only if they **add the school** on the profile. |
| **Discovery → Message** | Discovery can **Message the author** (today’s post preview cannot). Still cannot open the whole group. |
| **Data** | New **group message / thread** tables on existing `circles`. Reuse membership and DMs. Do not fork a second social graph. |
| **Old post data** | Migrate each old post target into one single-circle thread; hide old feed/composer navigation after parity validation. |

### 2.2 Does not change

| What | Stays |
|---|---|
| **Who is in which circle** | Profile sync via `syncCircleMembership()` (`school_class`, `class`, `school`, `locality`, `curriculum`, `community`). |
| **Belonging ≠ targeting** | You belong to five circles; a thread/message only goes where it is started / targeted — not auto-blasted to all five. |
| **Existing post tables during migration** | `circle_posts`, targets, replies, polls, media, topics, and shares remain intact until migration is verified. |
| **Existing feed APIs during migration** | Continue working as compatibility/read paths; no destructive cutover. |
| **1:1 DM foundation** | `conversations`, `direct_messages`, connection requests, and disclosures are extended, not replaced. |
| **Schools screen** | Directory / browse. No school posting into groups or Home. |
| **Doctors** | Parent logistics directory; not medical advice; not clinic blasts in class chat. |
| **Playdates, carpool, market, activities, calendar** | As they are. |
| **Privacy** | Anonymous handles in groups; real identity only via 1:1 disclosure; reports; content guard (including medical). |
| **Guest / outsider limits** | No full group history, no member list, no `canOpenCircle` for non-members (same idea as today’s `discovery_preview` / `share_preview`). |

### 2.3 Will not do

| Do not | Why |
|---|---|
| Drop the post/feed stack during chat launch | Migrate and verify first; retain as a read-only archive and audit source (not a post-cutover rollback target, see §11.13) |
| One Home stream of every chat line from every group | Noise; you don’t know who you’re talking to |
| Tutors as members of class / school / PIN groups | Groups become ads |
| Home only for professionals | Empty or salesy; parents stop talking in public |
| An interest hashtag as its own group | Another giant mute |
| School 2’s group in a school 1 parent’s Messages | Belonging is not browsing |
| Every “ok” stored as `circle_posts` | Drowns Home, Your Posts, and timelines |
| A second `circles` / membership graph for chat | Privacy will drift |

---

## 3. Definitions (copy and objects)

Do not mix these words in the parent UI.

| Term | Meaning | UI |
|---|---|---|
| **Message** | A line in a group or 1:1. Default parent action. | Bubble |
| **Thread** | A topic in a group. Replies live **inside** it. Lasting parent object (pediatrician, fees, poll, circular photo). | Chat, opened from a snippet |
| **Group** | A circle the user **belongs to**. Auto-membership. | Row in Messages |
| **DM** | 1:1 parent–parent or parent–tutor. | Messages |
| **Tutor channel** | That tutor’s row for **offers**. Not a parent group. | Services |
| **Post** | Legacy feed item. Migrated to one or more single-circle threads. No post UI after cutover. | Compatibility/archive only |

**Which object:** if it should still matter after the room goes quiet →
**thread**. If the point is an answer in the next few minutes → **chat**.
Replies are never Home rows.

Product language: group, chat, thread, topic, message, Message, Guest,
Tutor. Do **not** say Slack, post, composer, or feed on this surface.

---

## 4. Surfaces

| Tab | Job |
|---|---|
| **Home** | Door. Chat-format **rows**. Tap → that thread/group or tutor channel. Normal DMs stay in Messages. |
| **Messages** | Inbox. Member groups + DMs + Services. Replaces Circles as the place you *talk*. |
| **Circles (old)** | Removed from navigation after migration. Its groups are in Messages; legacy feed routes remain only as read-only compatibility. |
| **Schools / Doctors** | Options / directories only. |

Home is never a group. Messages is never a second Home feed of cards.

### 4.1 Home rows

| Row kind | Who sees it | Tap opens |
|---|---|---|
| Member snippet | Viewer is a member of that group | That group, on that thread |
| Discovery snippet | Viewer is **not** a member | **That thread only** (preview). Not the whole group |
| Tutor / trainer / nutritionist | Service area match | Their channel (offer). Message → tutor DM |

**On Home from your groups:** thread **heads** (topic + last reply preview
+ unread). Not every “ok / thanks.”

**Not on Home:** every chat line, tutor spam inside class bubbles, full
other-school groups.

### 4.2 Messages list

WhatsApp-style, one list or three sections:

1. **Your groups** — membership sync, unchanged set of circle types
2. **DMs** — parent and tutor 1:1s (distinguishable by role/badge)
3. **Services** — tutor / trainer / nutritionist channels

Each group row: name, last message preview, time, unread count.

---

## 5. How each group behaves

Membership is unchanged. Only the **inside** of the group changes.

| `circle_type` | Interior | Rule |
|---|---|---|
| `school_class` | Linear **group chat** | Tight; running chat is OK |
| `class` | **Threads** (default) | Board + grade is large |
| `school` | **Threads** | Whole school as chat is noise |
| `locality` | **Threads** | PIN as WhatsApp is muted |
| `curriculum` | **Threads** | “All CBSE parents” as chat is a firehose |
| `community` | **Threads** (always, see §15.4) | Same noise rule; size can grow silently |

**Tight (class chat):** chronological messages, newest at the bottom,
input bar, reply-to, like. A parent can still **start a thread** for
something that should last and appear on Home.

**Wide (threads):** the group is a **list of topics**. Open a topic to
talk. Main list shows topic + last reply, not every line.

Starting a thread **from inside a group** locks that group. Starting from
Home picks the tightest group by default (same priority as today’s
composer: `school_class` → `class` → `school` → `community` → `locality`
→ `curriculum`) unless they choose another **member** group. It does
**not** auto-post to all circles they belong to.

### 5.1 Curriculum groups keep local scoping

Curriculum circles are city-wide or larger, so today’s feed narrows them:
`apps/api/src/services/feed.ts` and `apps/api/src/services/feed-timeline.ts`
apply a local filter when `circle_type = 'curriculum'` and `scope = 'local'`,
showing only authors who share the viewer’s PIN. That protection must survive,
otherwise “CBSE Parents” becomes a nationwide room on day one.

| Surface | Curriculum behavior |
|---|---|
| Curriculum group thread list | Two scopes, `local` (default) and `all`, matching today’s feed parameter. `local` shows only threads whose author shares the viewer’s PIN. |
| Home member snippet attributed to a curriculum circle | Local only. A curriculum thread from a non-shared PIN is not a Home row. |
| Inside an opened curriculum thread | No author filtering. If the thread is visible, its replies are visible; scope filters thread heads, not conversation. |
| Notifications | Follow the same rule as the thread head: no push for curriculum threads outside the viewer’s PIN unless they follow or authored the thread. |

`locality`, `school`, `school_class`, `class`, and `community` circles need no
scope parameter; their membership is already narrow.

---

## 6. Interests

Interests are **labels on a thread** (`post_topics` / topics catalog —
same idea as today).

- They **never** create a group
- They **never** add or remove who can see the thread
- Home **may** filter “Admissions”
- The conversation stays in the PIN / curriculum / class group where it
  was started

---

## 7. Tutors, trainers, nutritionists

Two jobs, two doors. **Not** `circle_members` of parent groups.

### 7.1 Promote

- Own **channel** on Home and Messages → Services
- Badge: *Tutor* / *Trainer* / *Nutritionist* + area (e.g. Gachibowli)
- Last line = the offer
- Tap → profile / listing / activity (fees, batch, Message)
- **Not** inserted as a peer message in Gaudium Grade 4

May reuse **listings** or **activities** (already scoped by pin /
curriculum) as the offer body. Frontend is a **conversation row**.

### 7.2 Reply to a parent

| Parent said | Tutor | Others |
|---|---|---|
| Thread: “Maths tutor in Gachibowli?” | **Guest-reply on that thread only**, badge *Tutor* | One labeled reply; no access to the rest of the group |
| Taps channel or labeled reply → Message | **Tutor DM** (`role = tutor`) | Private |

### 7.3 Dual identity

Same person can be Priya in Grade 4 and *Priya · Maths tutor*.

| Entry | Conversation |
|---|---|
| Message from the parent group / member list | Parent DM. No tutor badge. Existing connection/disclosure. |
| Message from tutor channel, listing, or *Tutor* reply | Tutor DM. Badge *Tutor*. |

Do **not** merge the two. A multi-role person chooses **Chat as Parent** or
**Chat as Tutor** when starting from a neutral profile. Entry from a parent
group fixes Parent; entry from a tutor channel or tutor reply fixes Tutor.
The selected presentation roles are immutable for that conversation. To
switch role, open/create the other context conversation.

Today `users.role` is a single `parent | provider` enum and
`conversations` is unique on the user pair. Both constraints must change:

- account capabilities come from `user_roles`, allowing one user to hold
  `parent` and `provider`;
- each conversation participant has a `presentation_role`;
- conversation uniqueness includes a deterministic `context_key`, so the
  same two users may have parent–parent and parent–tutor conversations;
- keep `initiated_from_circle_id`; add `initiated_from_thread_id`.

If they are only a parent, there is no second door.

---

## 8. School 1 wants school 2

**Belonging ≠ sitting in their group.**

| Intent | How |
|---|---|
| Browse the other school | **Schools** → school page. Not a Messages group. |
| See a useful thread | **Home discovery** snippet → **that thread** preview |
| Ask that school’s parents | **Guest thread** (*Guest* badge). One topic. Not membership. |
| Talk to one parent | **Message author** → connection request → 1:1 |
| Message a tutor there | Tutor channel → tutor DM |
| Actually join their groups | **Add school/child on profile** → membership sync → groups appear in Messages |

Guest / discovery still cannot: scroll the full group, see the member
list, or get the group permanently in Messages.

---

## 9. Schools and doctors

**Directories only.** No posting into Home or parent groups.

- Parent question about a pediatrician or a school = **parent thread** in
  PIN or school group
- If schools or clinics ever announce, they follow the **tutor pattern**
  (labeled channel / announcement), not class membership. That is
  **not** part of this model.

---

## 10. Access (who can do what)

Same spirit as `apps/api/src/lib/thread-access.ts`, applied to groups and
threads.

| Viewer | Open full group | Read this thread | Reply in thread | Message author | Member list |
|---|---|---|---|---|---|
| Member | Yes | Yes | Yes | Yes (parent DM) | Yes |
| Guest author of this thread | No | Yes (their thread) | Yes (their thread) | n/a | No |
| Discovery / other school | No | Yes (that thread only) | Only after an explicit guest grant or when they author the guest thread | **Yes** (request first) | No |
| Share link | No | Yes (that thread, read-only) | No | No | No |
| Tutor (not member) | No | Only opted-in service-request threads matched to them | Guest-reply on those only | Tutor DM if parent messages them | No |

Today `discovery_preview` has `canMessageAuthor: false` and
`canReply: false`. This model **turns Message author on** for discovery
threads. Full-group open stays false.

---

## 11. Locked database model

**UIs are separate. Rooms and people are not. PostgreSQL is always the
source of truth.**

Use text columns with `CHECK` constraints for new status/role values where
frequent evolution is expected. The current migration runner wraps each
migration in a transaction, so PostgreSQL enum additions require separate
migrations.

### 11.1 Reuse (do not fork)

| Table / service | Use |
|---|---|
| `circles` | The group *is* the circle |
| `circle_members` | Current membership only; do **not** reuse its existing `last_read_at` for chat |
| `syncCircleMembership()` | Still determines which parent groups appear in Messages |
| `conversations`, `conversation_participants`, `direct_messages` | Extend for role-context DMs |
| `parent_connection_requests` | Required before a discovery viewer can DM an author |
| Disclosures, contact details, blocks, reports | Same safety/privacy path |
| `users`, `providers` | Same account and provider profile, extended for multi-role users |
| `topics` | Same interest catalog; a new thread junction references it |
| `activities` (and appropriate listing records) | Canonical tutor offer content |
| `accepts_guest_posts` and guest quota ideas | Adapt to guest **threads**, not group membership |

### 11.2 `user_roles` — one account, multiple roles

Current `users.role` allows exactly one of `parent` or `provider`. Add:

```sql
user_roles (
  user_id uuid references users(id),
  role text check (role in ('parent', 'provider')),
  created_at timestamptz,
  primary key (user_id, role)
)
```

Backfill from `users.role`. A user may have both rows. Keep `users.role`
temporarily for compatibility, then stop using it for authorization.
Update `syncCircleMembership()` to check for a `user_roles(role='parent')`
row instead of requiring `users.role = 'parent'`.

- Parent capability requires a `parent` role plus the relevant profile /
  circle membership.
- Tutor capability requires a `provider` role plus a `providers` row.
- Adding the provider role does not automatically make a provider a parent.
  They must separately complete the child/location parent onboarding before
  receiving parent circles.
- Group display uses the selected `author_role`.
- A tutor acting as a parent gets the anonymous parent identity.
- A tutor acting as a tutor gets the provider name, provider type, and
  verification badge.

The legacy `provider_type` enum (`teacher | trainer | institution`) is too
narrow for nutritionists and multi-category providers. Add
`provider_categories(provider_id, category, created_at)` with categories such
as `tutor`, `trainer`, `nutritionist`, and `institution`; keep
`providers.provider_type` for compatibility until reads are migrated.

### 11.3 `circle_threads` — canonical, single-circle topic

Every new thread belongs to **exactly one** circle.

Ordering uses a **per-circle counter, not a global PostgreSQL sequence**.
A shared `nextval()` sequence assigns numbers at INSERT time but rows only
become visible at COMMIT, so a message holding `seq = 100` can commit after
one holding `seq = 101`. A client that already stored `101` and then asks for
`afterSeq = 101` would never receive `100`. That silently loses messages, so
the sequence approach is rejected.

```sql
ALTER TABLE circles ADD COLUMN chat_seq bigint NOT NULL DEFAULT 0;
```

Every chat write allocates its number inside the same transaction:

```sql
UPDATE circles SET chat_seq = chat_seq + 1
 WHERE id = $1
RETURNING chat_seq;
```

The row lock is held until commit, so concurrent writers in the same circle
serialize and **assignment order equals commit order**. Numbers are gap-free
and monotonic per circle, which is exactly what `afterSeq` catch-up requires.
Serializing writes per circle is acceptable at group-chat volume; circles are
independent, so there is no global write hotspot. Cross-circle ordering is
never needed: catch-up is always per circle or per thread, and Home/Messages
order by `last_message_at`.

```sql
circle_threads (
  id uuid primary key,
  created_seq bigint not null,
  last_activity_seq bigint not null,
  circle_id uuid not null references circles(id),
  author_id uuid not null references users(id),
  author_role text not null check (author_role in ('parent', 'provider')),
  title text,
  body text,
  kind text not null check (
    kind in ('question', 'recommendation', 'heads_up', 'poll', 'general')
  ),
  home_visibility text not null check (
    home_visibility in ('member', 'discoverable', 'hidden')
  ),
  service_replies_allowed boolean not null default false,
  status text not null check (
    status in ('open', 'closed', 'deleted', 'moderated')
  ),
  last_message_at timestamptz not null,
  reply_count int not null default 0,
  source_post_id uuid references circle_posts(id),
  source_target_circle_id uuid references circles(id),
  reshared_from_thread_id uuid references circle_threads(id),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

On insert, `created_seq` and `last_activity_seq` both take the newly allocated
`circles.chat_seq` value, and `last_message_at = created_at`. Each reply
allocates a new number and atomically updates `last_activity_seq` and
`last_message_at`. Normal thread creation requires the parent role.
Provider-role creation in a parent circle is rejected; providers participate
only through scoped replies.

`title` is **nullable**. New threads started in the app require a title, which
is enforced in the API, not the schema. Migrated legacy posts have no title
because `circle_posts` stores only `body` and `tag`; §11.13 defines how they
are rendered. A NOT NULL title would make the migration impossible.

Required indexes:

- unique `(circle_id, created_seq)`
- unique `(id, circle_id)`, the target of the composite foreign key in §11.6
- `(circle_id, last_activity_seq DESC)` for group topic lists
- `(circle_id, created_seq DESC)` for new-topic order
- `(author_id, created_at DESC)` for “your threads” / moderation
- partial discoverable index on `(last_message_at DESC, id DESC)` where
  `home_visibility = 'discoverable' AND status = 'open'`
- unique `(source_post_id, source_target_circle_id)` for migration

`circle_thread_topics(thread_id, topic_id)` reuses `topics`. Do **not**
reuse `post_topics`; its foreign key is to posts.

Thread media, documents, and polls use thread-specific junctions/tables
with the same validation and storage rules as existing post media,
documents, and polls. Do not use an unconstrained polymorphic foreign key.

### 11.4 Single-circle means

- Only current members of **that exact circle** may read the full group and
  reply by default.
- Membership in another circle is irrelevant, even if it overlaps by school,
  PIN, grade, or curriculum.
- A non-member may read/reply only through an explicit thread-scoped grant.
- A guest who **created** the thread automatically receives a
  `guest_author` grant and may read/reply to that thread.
- A thread author may invite a specific non-member; that person receives a
  `guest_replier` grant and may read/reply only there.
- An eligible tutor receives a `provider_responder` grant only for an
  opted-in service-request thread.
- None of these grants allows the full group, history, or member list.
- `guest_author` remains active while the thread exists; closing stops writes
  but not reading. It can be revoked only by moderation/block enforcement.
- `guest_replier` is for parent identities only. Provider identities must use
  `provider_responder` and the service-consent rules.

There is no multi-target chat thread. To share a topic into another circle,
create a new thread with `reshared_from_thread_id`; its future replies are
separate.

### 11.5 `circle_thread_access_grants` — guests and tutors

```sql
circle_thread_access_grants (
  thread_id uuid references circle_threads(id),
  user_id uuid references users(id),
  grant_role text check (
    grant_role in ('guest_author', 'guest_replier', 'provider_responder')
  ),
  granted_by uuid references users(id),
  can_reply boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  primary key (thread_id, user_id, grant_role)
)
```

The API checks current circle membership **or** an active grant on every
thread GET and reply. Knowing a UUID is never authorization.

### 11.6 `circle_messages` — chat lines and thread replies

```sql
circle_messages (
  id uuid primary key,
  seq bigint not null,
  circle_id uuid not null references circles(id),
  thread_id uuid references circle_threads(id),
  author_id uuid not null references users(id),
  author_role text not null check (author_role in ('parent', 'provider')),
  body text,
  reply_to_message_id uuid references circle_messages(id),
  client_message_id uuid not null,
  status text not null check (
    status in ('visible', 'deleted', 'moderated')
  ),
  edited_at timestamptz,
  deleted_at timestamptz,
  source_reply_id uuid references circle_post_replies(id),
  created_at timestamptz not null,
  unique (circle_id, seq),
  unique (author_id, client_message_id),
  unique (thread_id, source_reply_id)
)
```

- `seq` comes from the same per-circle `circles.chat_seq` counter used by
  thread creation, so one monotonic, gap-free cursor per circle covers both
  new threads and new messages.
- `thread_id IS NULL` = linear message in a tight group.
- `thread_id IS NOT NULL` = reply inside that single-circle thread.
- A message may never sit in a thread from another circle. Enforce it in the
  database with a unique key on `circle_threads(id, circle_id)` and a composite
  foreign key from `circle_messages(thread_id, circle_id)`, so the invariant
  cannot be broken by a code path that forgets to check.
- `seq` is the durable cursor for catch-up and ordering, and is meaningful
  only within its circle; UUID remains the public identity. Clients store one
  `seq` per circle, never one global cursor.
- `client_message_id` makes offline retries idempotent.
- `reply_to_message_id` must be in the same circle and, when present, the
  same thread.

Indexes:

- `(circle_id, seq DESC)` where `thread_id IS NULL`
- `(thread_id, seq ASC)` where `thread_id IS NOT NULL`
- `(author_id, created_at DESC)`

`circle_message_reactions(message_id, user_id, reaction, created_at)` has
a unique key `(message_id, user_id, reaction)`.

`circle_message_mentions(message_id, mentioned_user_id, created_at)` has a
unique key `(message_id, mentioned_user_id)`. The API resolves mentions from
eligible current group members; notification code never parses display text.

Message attachments use `circle_message_media`. Allowed types, size limits,
upload quarantine/scanning, and CDN/document access copy the existing post
media/document policies. Polls belong to a thread, not an individual chat
reply.

### 11.7 Separate read state (do not reuse feed read state)

`circle_members.last_read_at` already drives old-feed “new post” counts.
Reusing it would change the old feed before migration is complete.

Add:

```sql
circle_chat_reads (
  circle_id uuid references circles(id),
  user_id uuid references users(id),
  last_read_message_seq bigint,
  last_seen_thread_seq bigint,
  last_read_at timestamptz,
  primary key (circle_id, user_id)
)

circle_thread_reads (
  thread_id uuid references circle_threads(id),
  user_id uuid references users(id),
  last_read_seq bigint,
  last_read_at timestamptz,
  following boolean not null default false,
  muted_until timestamptz,
  primary key (thread_id, user_id)
)
```

- Tight-group unread counts linear messages after `last_read_message_seq`.
- Wide-group unread is the count of followed/authored threads with new
  activity after their thread cursor, plus thread heads created after
  `last_seen_thread_seq`.
- Opening a thread advances only its thread cursor.
- Opening the group list advances “thread heads seen,” not every thread’s
  reply cursor.
- Existing `notification_mutes(scope='circle')` remains for whole-group
  push mute; thread mute lives in `circle_thread_reads`.

### 11.8 Role-context DMs

Add `presentation_role` to `conversation_participants` and a deterministic
`context_key` to `conversations`.

Replace `UNIQUE(user_a_id, user_b_id)` with:

```sql
UNIQUE (user_a_id, user_b_id, context_key)
```

**Exact formula.** `conversations` already enforces `user_a_id < user_b_id`,
so the key binds each role to its sorted position and is computed by the API,
never supplied by the client:

```text
context_key = role_of(user_a_id) || ':' || role_of(user_b_id)
```

where each role is `parent` or `provider`. The key is therefore
position-dependent, not a sorted pair of role names: if Priya sorts first,
Priya-as-tutor talking to Anusha-as-parent is `provider:parent`, and if Anusha
sorts first the same pair is `parent:provider`. Both mean the same
conversation because the participant rows carry the authoritative roles.
`context_key` is `NOT NULL` and stored as a generated or API-set text column.

Possible keys:

| Key | Meaning |
|---|---|
| `parent:parent` | Ordinary parent-to-parent DM. Default for every existing row. |
| `parent:provider` / `provider:parent` | Parent talking to a tutor identity. |
| `provider:provider` | Two provider identities. Allowed by the schema; no UI entry point in this model. |

**Backfill.** Every existing conversation is `parent:parent`, including
marketplace, carpool, and playdate conversations. Those three surfaces are
parent-to-parent by definition and keep `parent:parent` when they create new
conversations; provider context is reachable only from a tutor channel,
listing, or *Tutor* reply.

**Existing call sites that must change in the same release.** Four places
assume one conversation per user pair and all four break otherwise:

| File | Current behavior | Required change |
|---|---|---|
| `apps/api/src/routes/circles.ts` | Upserts with `ON CONFLICT (user_a_id, user_b_id)` | PostgreSQL raises “no unique or exclusion constraint matching the ON CONFLICT specification” as soon as the constraint is replaced. The conflict target must include `context_key`. |
| `apps/api/src/routes/listings.ts` | Selects the pair, then takes `rows[0]` | Must filter `context_key = 'parent:parent'`, otherwise it can attach a marketplace thread to a tutor DM. |
| `apps/api/src/routes/playdates.ts` | Selects the pair, then takes `rows[0]` | Same filter. |
| `apps/api/src/routes/carpool.ts` | Selects the pair, then takes `rows[0]` | Same filter. |

Every future conversation lookup resolves by pair **and** context, so a shared
helper should own this rather than four inline queries.

The participants’ roles, not display strings, are authoritative. Both roles
are fixed when the conversation is created. A multi-role user gets a
**Chat as Parent / Chat as Tutor** choice only from a neutral entry point.
Contextual entry points select automatically.

### 11.9 Tutor channel storage

```sql
provider_channels (
  provider_id uuid primary key references providers(user_id),
  status text check (status in ('active', 'paused', 'suspended')),
  created_at timestamptz,
  updated_at timestamptz
)

provider_channel_updates (
  id uuid primary key,
  provider_id uuid references provider_channels(provider_id),
  activity_id uuid references activities(id),
  title text not null,
  preview text,
  published_at timestamptz,
  expires_at timestamptz,
  status text check (status in ('draft', 'published', 'expired', 'moderated'))
)

provider_channel_follows (
  provider_id uuid references provider_channels(provider_id),
  user_id uuid references users(id),
  last_read_at timestamptz,
  muted_until timestamptz,
  created_at timestamptz,
  primary key (provider_id, user_id)
)
```

The provider profile and `activities` are canonical; a channel update is a
lightweight promotion/preview pointing to an activity. Do not duplicate the
full activity payload.

- **Home** may discover eligible published updates.
- **Messages → Services** contains only followed/saved channels or providers
  with whom the parent has an active tutor DM. It is not every provider in
  the city.
- Eligibility comes from provider service PIN codes and the activity’s
  curriculum/grade/category targeting.
- Updates expire; expired offers disappear from Home but remain visible in
  the channel history unless moderated.
- Providers cannot publish directly into parent groups.

### 11.10 Durable chat outbox

```sql
chat_event_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  attempts int not null default 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null
)
```

Every accepted message/thread/channel write inserts an outbox event in the
same transaction. The worker retries push and Redis-index work. The API may
also publish an immediate best-effort realtime nudge after commit.

### 11.11 Membership history

Membership change means a parent edits/removes a child’s **school, grade, or
curriculum**, or changes **PIN/community**. Today
`syncCircleMembership()` deletes memberships no longer derived from the
profile.

Add:

```sql
circle_membership_periods (
  id uuid primary key,
  circle_id uuid not null references circles(id),
  user_id uuid not null references users(id),
  joined_at timestamptz not null,
  left_at timestamptz,
  reason text not null,
  created_at timestamptz not null
)
```

Use a partial unique index on `(circle_id, user_id)` where `left_at IS NULL`
and an index on `(user_id, joined_at DESC)`. Close/open periods during sync.

Rules:

- Leaving immediately revokes full group/history and realtime subscription.
- Existing messages remain and display the anonymous parent handle; do not
  snapshot or expose old school/child identity on the message row.
- Existing 1:1 DMs remain.
- Threads the person authored as an explicit guest remain available through
  their thread grant; ordinary former-member content does not preserve group
  access.
- Rejoining creates a new membership period.
- `school_class` and `school`: rejoined members see content from the current
  `joined_at` only.
- `class`, `locality`, `curriculum`, `community`: current members may see
  still-open threads created earlier, but not old linear chat history.

### 11.12 Reports and moderation schema

Extend `reports` with nullable `target_thread_id`,
`target_circle_message_id`, and `target_provider_channel_update_id`.
Only one target is allowed per report; enforce it with a
`num_nonnulls(...) = 1` check across all report target columns.

Vaara’s platform trust-and-safety administrators moderate. Parents, tutors,
schools, and doctors are **not** group administrators in this model.
Automated content guards and rate limits run before writes; user reports
feed the admin queue.

### 11.13 Migration of old posts and feeds

Old feed data is migrated; old tables are not dropped during cutover.

**Field mapping.** `circle_posts` has no title, so migrated threads carry
`title = NULL` and `body = circle_posts.body`. The client renders a titleless
thread using the first line of the body as its head; it does not fabricate and
store a synthetic title, which would create edit-history confusion.

| Legacy `tag` | Thread `kind` |
|---|---|
| `question` | `question` |
| `recommendation` | `recommendation` |
| `heads_up` | `heads_up` |
| `general` | `general` |

`kind = 'poll'` is **only** for threads created as a poll in the new composer.
A migrated post that happens to carry a poll keeps its mapped tag as `kind`
and attaches the poll, because a poll is thread content, not a thread type.

`home_visibility` follows the legacy target’s nature:

- normal member target → `discoverable`, matching today’s Home discovery;
- guest placement target → `member`, so a guest post does not gain Home
  discovery it never had;
- post already hidden, removed, or authored by a suspended user →
  `hidden`.

For each `circle_post_targets` row:

1. Create **one** `circle_threads` row for that target circle.
2. Set `source_post_id` and `source_target_circle_id`.
3. Copy post topics, media, documents, and poll into thread equivalents.
4. Copy each historical `circle_post_replies` row into each migrated target
   thread as a legacy `circle_messages` reply with a stable source mapping.
   This preserves the audience exposure of the old shared thread; all future
   replies are isolated to the target circle.
5. Mark migrated messages as legacy imports for audit/display, even when a
   reply author is not a current member of that target. **Legacy imports are
   read-only:** because one old reply becomes several copies (one per target
   thread), author edit and author delete are disabled on them, and moderator
   removal fans out to every copy sharing that `source_reply_id`. Only new
   replies written after cutover are editable/deletable by their author.
6. Backfill thread/read/Home indexes.
7. Map helpful marks to a thread-level helpful/reaction record; map saved
   posts to thread follows/saves. Preserve poll options and votes.
8. Redirect each active legacy share URL to the thread matching its
   `target_circle_id`. Feed impressions are analytics history and are not
   converted into unread state.
9. Validate counts and samples before hiding old Home/circle-feed/composer
   navigation.

After validation:

- new parent writes go only to chat/thread APIs;
- legacy feed APIs become read-only compatibility paths;
- old tables remain until an explicitly approved cleanup migration.

**Cutover is one-way.** Once parents write only threads and messages, the old
feed cannot display that content, so restoring the old navigation would show a
feed frozen at the migration timestamp and hide everything said since. The
retained tables are an **archive and audit source, not a rollback target**.

Rollback is only meaningful inside a defined pre-cutover window:

| Stage | Rollback available |
|---|---|
| Migration run, old navigation still live | Yes. Chat is additive; hide the new surfaces. |
| Chat launched to a cohort, old navigation still live | Yes, per cohort, provided the cohort keeps writing posts too. |
| Old navigation hidden, chat is the only writer | No. Forward-fix only. |

If a genuine post-cutover rollback is required, it must be bought explicitly
with a dual-write window where every new thread also writes a legacy post.
That is not part of this model; the default plan is forward-fix.

---

## 12. Message refresh, realtime, and offline behavior

### 12.1 Source of truth

PostgreSQL is authoritative for messages, threads, access grants, read
cursors, and channel updates. Redis is never the only copy of a message and
never grants access.

### 12.2 Send path

1. Client creates `client_message_id` and renders an optimistic bubble.
2. API authenticates the selected role and checks membership or thread grant.
3. In one PostgreSQL transaction: insert message (idempotently), update
   thread/group activity, and insert `chat_event_outbox`.
4. Commit.
5. Return canonical message ID and `seq` to replace the optimistic bubble.
6. Best-effort publish a Redis event immediately.
7. Worker drains the outbox for durable cache/index updates and push.

Redis failure cannot lose an accepted message. Duplicate retries return the
existing row because `(author_id, client_message_id)` is unique.

### 12.3 Receive path

The existing architecture is retained:

```text
Phone ──WebSocket──▶ realtime gateway
                         ▲
                         │ Redis Pub/Sub (nudge only)
API / worker ────────────┘
          │
          └──────────────▶ PostgreSQL (source of truth)
```

Channels:

- `circle:{circleId}` — new linear message / new thread / thread activity
- `thread:{threadId}` — replies, edit, delete, reaction
- `conversation:{conversationId}` — existing 1:1
- `user:{userId}:inbox` — group/DM/channel row changed

The realtime gateway authorizes every subscription:

- circle → current `circle_members`
- thread → current circle membership or active thread grant
- conversation → participant
- inbox → same user

An event contains IDs and cursors, not trusted message content. On an event,
the app fetches `afterSeq` (or invalidates the query); API authorization is
checked again.

**Revoking a live subscription.** The gateway authorizes at subscribe time
only, so a socket opened while someone was a member stays open after their
membership closes. Losing membership must therefore actively evict, not just
fail the next subscribe:

1. Membership close and grant revocation publish an `access.revoked` event on
   `user:{userId}:inbox` with the circle or thread ID. This is a new variant of
   the `RealtimeEvent` union in `packages/redis/src/pubsub.ts`, not a stored
   notification, so it never reaches the `notification_type` enum or push.
2. The gateway drops that socket’s matching `circle:` / `thread:`
   subscriptions on receipt.
3. The gateway re-verifies every active subscription on a periodic sweep
   (default **60 seconds**) so a missed Pub/Sub event cannot extend access
   indefinitely.
4. Because realtime carries only IDs and cursors, the API remains the real
   boundary: a stale subscriber learns an ID changed and is then refused the
   content by the authorization check on the fetch.

Step 4 is why a delayed eviction leaks nothing sensitive, and steps 1–3 are
why it does not persist.

### 12.4 Reconnect and polling

- On WebSocket reconnect and every foreground transition, fetch everything
  after the last stored `seq` **for each affected circle**, since `seq` is
  per-circle (§11.3). There is no single global cursor to resume from.
- Active open chat/thread: poll every **15 seconds** only while WebSocket is
  unavailable.
- Messages list and Home: poll every **60 seconds** while WebSocket is
  unavailable.
- Older history loads from PostgreSQL using cursor pagination.
- A missed Pub/Sub event therefore delays refresh; it never loses data.

### 12.5 Redis responsibilities and limits

Use Redis for:

1. **Pub/Sub realtime nudges** to the existing WebSocket gateway.
2. **BullMQ jobs** for push notifications, digest work, and outbox processing.
3. **Rate limits** (plus DB-backed quotas for guest/provider-sensitive paths).
4. **Short-lived list cache** for Messages/Home.
5. Optional hot recent-ID indexes:
   - `chat:circle:{circleId}:messages` — newest ~500 linear message IDs
   - `chat:circle:{circleId}:threads` — newest/active ~500 thread IDs
   - `chat:thread:{threadId}:messages` — newest ~500 reply IDs

Redis is **not** used for:

- full history;
- canonical unread state;
- membership or permission decisions;
- permanent thread/message storage;
- a per-user copy of every message.

All Redis reads fail back to PostgreSQL. Redis timelines are accelerators,
following the current circle-feed pattern (`off | shadow | on` before full
enablement). Existing post timeline keys remain separate until old-feed
retirement.

Configuration:

| Variable | Default | Meaning |
|---|---|---|
| `CHAT_REDIS_INDEX` | `off` | `off` = PostgreSQL only; `shadow` = compare Redis IDs with SQL; `on` = Redis recent-window index with SQL fallback |
| `CHAT_LIST_CACHE_TTL_SECONDS` | `30` | Short TTL for Home/Messages list JSON; shorter than the current 120-second feed cache |
| `CHAT_TIMELINE_MAX` | `500` | Maximum IDs in each recent-message/thread Redis sorted set |

Invalidate the relevant Home/Messages list cache on every committed activity.
Do not use the existing `feed:v1:*` or `timeline:v1:*` keys; chat uses
versioned `chat:v1:*` keys. When Redis is enabled, the realtime gateway and
BullMQ worker health/backlog must be monitored because Pub/Sub and queued
push work depend on them.

---

## 13. Home eligibility and ranking

Home is a ranked list of **thread/channel snippets**, not every message and
not normal DMs.

### 13.1 Eligible rows

**Member thread**

- viewer is a current member of the thread’s one circle;
- thread is not deleted/moderated;
- `home_visibility != 'hidden'`;
- linear class-chat messages are not eligible unless converted into /
  started as a thread.

**Discovery thread**

- viewer is not a member of the thread circle;
- `home_visibility = 'discoverable'`;
- the thread and circle permit discovery;
- match is same PIN, school relationship, curriculum/grade relevance, then
  broader safe discovery;
- blocked users and already dismissed rows are excluded;
- tap opens that thread only.

**Service update**

- published and not expired/moderated;
- service PIN/category/curriculum/grade matches the parent;
- provider is not blocked/suspended.

Normal parent DMs do **not** appear as Home rows; they stay in Messages.
A Home tutor row may lead to a tutor channel, and its **Message** action
opens/creates the role-context DM.

### 13.2 Ranking buckets

Order buckets, then use `last_message_at DESC, id DESC` inside a bucket:

1. New replies on threads the viewer authored or follows
2. Unseen threads from the viewer’s own circles
3. Active previously seen threads from the viewer’s own circles
4. Unseen relevant discovery threads
5. Eligible provider channel updates
6. Seen discovery/history

Circle relevance tie-break:

`school_class` → `class` → `school` → `community` → `locality` →
`curriculum`.

Rules:

- dedupe by `thread_id`;
- show at most one row per thread regardless of reply count;
- provider updates are capped at **one per eight organic thread rows**;
- a followed provider may rank in Messages → Services but does not bypass
  the Home cap;
- no push for general discovery rows;
- use a stable cursor containing bucket, activity time, and ID.

Add `home_thread_impressions(user_id, thread_id, first_seen_at,
last_seen_at, dismissed_at)` and a corresponding provider-update impression
table. Do not overload `feed_post_impressions`.

### 13.3 Empty and thin states

A chat product looks broken when the rooms are silent, and at launch most
groups will be. Define these explicitly rather than shipping a blank list.

| Situation | Home | Group interior |
|---|---|---|
| Just onboarded, no activity anywhere | Migrated threads from the parent’s circles fill Home first, since migration guarantees history exists. Below them, a single prompt to start a thread with two example asks. | Topic list shows migrated threads; a tight group with no messages shows the composer plus a one-line “start the conversation” hint. |
| Groups exist but all are quiet | Widen to eligible discovery threads earlier than the ranking buckets would normally allow, so Home is never shorter than five rows when eligible content exists. | Unchanged; a quiet group is honestly quiet. |
| Genuinely nothing eligible | Show which groups they belong to and a prompt to ask something, never an empty screen or a spinner. | Same. |
| Provider rows are the only eligible content | Suppress them. The one-per-eight cap means provider rows never appear without organic rows above them; an all-ads Home is worse than a short one. |  |

The migration is what makes this workable: because every old post becomes a
thread, day-one Home is populated with real parent content rather than
placeholder copy.

---

## 14. Tutor reply consent and matching

“Tutor consent” means the **parent’s consent to expose one service-request
thread to eligible providers**, not consent for the tutor to join the group.

- The thread author explicitly enables **Allow qualified providers to reply**.
- Default is off unless the parent selects a service-request category; even
  then the choice is shown before publish.
- Matching uses provider type/category, service PINs, curriculum/grade
  targeting, verification/suspension state, and blocks.
- A matched tutor sees only the thread title/body, coarse circle label, and
  allowed attachments—not the group history, members, child identity, or
  exact address.
- Opening the matched request creates a thread-scoped
  `provider_responder` grant.
- Each provider may make one initial top-level response per thread; follow-up
  replies require parent engagement or an active DM.
- The parent can revoke provider replies, block a provider, or turn service
  replies off. Revocation removes access but preserves already-visible
  messages for moderation/audit.

Provider discovery and initial responses need DB-backed daily quotas in
addition to Redis rate limits, because the current Redis limiter fails open
during outages.

---

## 15. Moderation, blocks, and message lifecycle

### 15.1 Who moderates

Vaara platform trust-and-safety administrators moderate reports. There are
no parent/tutor/school volunteer admins in this model.

Automated controls:

- content guard before create/edit for group messages, threads, provider
  responses, and channel updates (including the medical-advice policy);
- link/media validation and malware/quarantine workflow;
- Redis request rate limit;
- DB quotas for guest threads, discovery requests, and provider replies;
- block checks on reads, writes, invitations, and notifications.

Normal 1:1 text DMs are not treated as public content: retain block/report
and attachment safety rather than publishing/scanning them as group content.

### 15.2 User controls

- Report thread, message, tutor update, conversation, or user.
- Block user/provider: no future DMs, grants, provider matching, or
  notifications between the pair.
- Mute whole group or one thread.
- Leave/follow service channel without affecting circle membership.

**What a block does inside a shared group.** A block cannot remove either
person from a circle, because membership comes from the child profile. So the
rule is symmetric hiding of content, without announcing the block:

| Surface | Effect of A blocking B |
|---|---|
| Linear group messages | Each hides the other’s messages. Nothing is rendered, not even a tombstone, so a block is not broadcast to the room. Unread counts skip hidden messages. |
| Replies inside a thread | Same hiding. A visible reply that quoted a hidden message shows “Message unavailable” in the quote only, so the conversation still reads coherently. |
| Thread heads | A thread authored by B is not a Home row for A and does not appear in A’s group topic list, and the reverse. |
| Replying | Neither can reply inside a thread authored by the other. Both may still reply to the same third-party thread and simply will not see each other. |
| Mentions | An `@mention` across a block is not delivered and produces no push. |
| DMs, grants, provider matching | Fully blocked, as today. |

Consequence to accept: two blocked parents can answer the same question and
each see a partial thread. That is preferable to either leaking a block or
forcing someone out of their own class group.

### 15.3 Edit, delete, close

- Message author may edit for **15 minutes**; show “edited.”
- Message author may delete for everyone for **24 hours**; render “Message
  deleted” so reply structure remains.
- Thread author may edit title/body for **60 minutes**.
- Thread author may close/reopen the thread; closing stops replies.
- Thread author may delete a thread only while it has no replies. Otherwise
  they close it or request moderation.
- Moderators may soft-remove any object immediately.
- Deleting an account anonymizes retained group content according to the
  account-deletion policy; it does not silently remove other users’ replies.

Deleted/moderated content is retained, access-restricted, for **90 days** for
abuse investigation and then purged, unless legal hold applies. Attachments
follow the same deletion schedule.

### 15.4 Limits and page sizes

Values are fixed here so implementation does not invent them. Existing
conventions are `circle-post` 10/hour, `direct-message` 50/hour, and
`parent-connection-request` 10/day via `rateLimitMiddleware`.

| Control | Value | Enforcement |
|---|---|---|
| Group message send | 60 per hour per user, burst 10 per 10 seconds | Redis rate limit |
| Thread create | 10 per hour per user | Redis rate limit |
| Guest thread create | 5 per day per user | DB quota (fails closed) |
| Discovery “Message author” request | 10 per day per user | Existing connection-request limit |
| Provider initial responses | 20 per day per provider, 1 per thread | DB quota (fails closed) |
| Provider channel updates | 5 published per day, 20 active | DB quota |
| Reactions | 120 per hour per user | Redis rate limit |
| Message body | 4000 characters | API validation |
| Thread title / body | 140 / 4000 characters | API validation |
| Attachments per message | 4, reusing existing post media size and type limits | API validation |

Safety-sensitive paths (guest threads, provider responses, channel updates)
use DB quotas because the Redis limiter fails open during an outage. Ordinary
chat volume paths may fail open; a Redis outage should not stop parents from
talking.

| Page | Default | Max |
|---|---|---|
| Linear group messages | 40 newest, older by `beforeSeq` | 100 |
| Thread replies | 40 ascending from cursor | 100 |
| Group thread list | 25 heads | 50 |
| Home | 20 rows | 40 |
| Messages inbox | 40 rows | 80 |

**Community sizing.** The “chat only if truly small” note in §5 is resolved:
`community` circles use **threads unconditionally** in the first release.
Membership is profile-derived and can grow without warning, so a size
threshold would silently flip a group’s interior between chat and threads and
break unread semantics for everyone in it. A linear mode for small
communities may be reconsidered after launch data.

---

## 16. Membership changes

A membership change is caused by editing/removing a child’s school, grade,
or curriculum, or changing PIN/community. It is performed automatically by
profile sync, not by a group moderator.

Example: a child moves from Gaudium Grade 4 to Oakridge Grade 5:

1. Gaudium school/class memberships close.
2. Realtime subscriptions and full history access are revoked.
3. Oakridge school/class memberships open and appear in Messages.
4. Past Gaudium messages remain for Gaudium members under the old anonymous
   identity.
5. Existing 1:1 DMs remain.

The history rules and `circle_membership_periods` are specified in §11.11.

---

## 17. API contract (minimum complete surface)

Group/list:

- `GET /v1/chat/inbox` — groups + DMs + followed Services rows
- `GET /v1/chat/home` — ranked thread/channel snippets
- `POST /v1/chat/home/impressions`
- `GET /v1/circles/:circleId/messages?beforeSeq=`
- `POST /v1/circles/:circleId/messages`
- `PATCH|DELETE /v1/circles/:circleId/messages/:messageId`
- `POST|DELETE /v1/circles/:circleId/messages/:messageId/reactions`
- `POST /v1/circles/:circleId/chat-read`

Threads:

- `GET /v1/circles/:circleId/threads?cursor=&scope=` — `scope` accepts
  `local | all` and applies only to `curriculum` circles (§5.1), defaulting to
  `local`
- `POST /v1/circles/:circleId/threads`
- `POST /v1/circles/:circleId/guest-threads`
- `GET|PATCH|DELETE /v1/threads/:threadId`
- `GET /v1/threads/:threadId/messages?afterSeq=&beforeSeq=`
- `POST /v1/threads/:threadId/messages`
- `POST /v1/threads/:threadId/read`
- `POST|DELETE /v1/threads/:threadId/follow`
- `POST|DELETE /v1/threads/:threadId/grants`
- `POST /v1/threads/:threadId/message-author`

Providers:

- `GET /v1/provider-channels/:providerId`
- `POST /v1/provider-channels/:providerId/follow`
- `DELETE /v1/provider-channels/:providerId/follow`
- provider-owned create/update/expire endpoints for channel updates
- matched service-request queue and one-response endpoint

DM create/update:

- `POST /v1/conversations` accepts the contextual entry source and
  participant presentation roles; a neutral multi-role entry asks
  **Chat as Parent / Chat as Tutor**.
- Existing conversation message/read/disclosure APIs continue using the
  resolved `conversationId`; presentation role cannot change in place.

Every write accepts a client idempotency key. Every list is cursor-paginated.
Every read/write repeats authorization server-side.

---

## 18. Notifications

Add notification preference keys for:

- `group_messages`
- `thread_replies`
- `thread_mentions`
- `provider_responses`
- `service_updates`

Push rules:

- Linear tight-group messages are bundled; do not push one notification per
  line during a burst.
- Thread author/followers receive reply notifications unless muted.
- `@mention` may bypass normal bundling, never a block/mute.
- Provider response goes only to the requesting parent / followers.
- General discovery is Home-only; no push.
- Quiet hours remain enforced.
- If Redis is enabled, the worker is required because BullMQ handles push;
  a health check must detect queue backlog / missing worker.

---

## 19. Cast (same people as the post docs)

Anusha: one child at Gaudium, CBSE, Grade 4, PIN 502032. Member of:

1. Gaudium · CBSE · Grade 4 (`school_class`)
2. CBSE · Grade 4 (`class`)
3. Gaudium (`school`)
4. 502032 (`locality`)
5. CBSE Parents (`curriculum`)

| Person | Overlap with Anusha |
|---|---|
| **Priya** | Same school, grade, board, PIN |
| **Ravi** | Gaudium + PIN, different grade |
| **Kavya** | Different school, same grade/board/PIN |
| **Sana** | Same PIN, IB |
| **Arjun** | Different city, IB |
| **Meera** | Oakridge (school 2), same city |
| **Priya as tutor** | Same Priya; maths tutor in Gachibowli |

### 19.1 School-class chat

Anusha and Priya have **Gaudium Grade 4** in Messages. “White shoes
tomorrow?” is chat. It does not flood Home. Ravi (different grade) is not
in that group.

### 19.2 PIN thread + Home

Anusha starts a **thread** in 502032: “Which pediatrician near 502032?”
Priya, Ravi, Kavya, Sana see it in the PIN group and as a **Home snippet**.
Tap opens that thread. Arjun does not. Replies stay in the thread.

### 19.3 Tutor

Priya’s **Services** channel is visible to parents in her area. It is not
a member of Grade 4. Anusha → Message on the channel = **tutor DM**.
Anusha → Message Priya in Grade 4 = **parent DM**.

### 19.4 School 2

Anusha sees Meera’s Oakridge thread on Home (discovery). Tap = that thread
preview. Guest-reply or Message Meera. Oakridge Grade 4 is **not** in
Anusha’s Messages groups.

### 19.5 Belonging vs where talk lives

Anusha belongs to five groups. A Grade 4 chat stays in Grade 4. A PIN
thread stays in PIN (and can snippet on Home). Nothing is auto-copied
into CBSE Parents unless she starts it there.

---

## 20. End-to-end journeys

### A. Daily class talk

Open Messages → Gaudium Grade 4 → type. Priya replies in the stream.
Unread on that row. Home unchanged unless someone starts a lasting
thread.

### B. Lasting ask

In 502032 (or from Home, defaulting to tightest group, then she picks
PIN) → **Start thread** → pediatrician question. Members of 502032 see
it in the group topic list and on Home. Tap Home → same thread. Sana
replies there.

### C. Tutor offer

Parent sees *Green Valley Tutors · New Grade 5 batch* on Home/Messages
Services → tap channel → Message → tutor DM.

### D. Tutor answers a parent thread

Parent thread in PIN tagged/visible to matching tutors → tutor
guest-replies, badge *Tutor*. Tutor cannot open the rest of PIN chat.
Parent Message on that reply → tutor DM.

### E. Other school

Home shows Oakridge snippet → tap thread preview → Message author →
request → 1:1. Or Start guest thread on Oakridge from Schools. Add
Oakridge on profile only if they want the groups in Messages.

### F. Old posts

Migration creates one thread per old post target and imports historical
replies. After validation the old feed/composer disappears from navigation;
legacy APIs/tables remain read-only for compatibility and audit. That step is
one-way (§11.13).

---

## 21. Final implementation invariants

1. Every thread belongs to exactly one circle.
2. Members of other circles cannot reply unless explicitly granted on that
   thread.
3. Guest authors can always read/reply to their own thread while their grant
   is active.
4. PostgreSQL is canonical; Redis only accelerates and signals.
5. Feed read state and chat read state are separate.
6. A user may hold both parent and provider roles.
7. DM presentation role is fixed per conversation context.
8. Tutors never become parent-group members through a reply.
9. Home contains thread/channel snippets, not raw chat lines or normal DMs.
10. Old posts are migrated before old navigation is hidden; no destructive
    table drop is part of cutover.
11. Ordering uses a per-circle counter allocated in the write transaction,
    never a shared sequence, so `afterSeq` catch-up cannot skip a message.
12. Hiding old navigation is one-way; the retained tables are an archive, not
    a rollback target.
13. Curriculum groups stay PIN-scoped by default.
14. A block hides content symmetrically inside shared groups and never removes
    anyone from a circle.

---

## 22. Database migration order

Latest registered migration today is `041_onboarding_discovery_hardening`.
Use additive migrations in this dependency order:

1. `042_chat_notification_types` — **enum additions only**, adding exactly
   these `notification_type` values: `group_message`, `thread_reply`,
   `thread_mention`, `provider_response`, `service_update`. Nothing in this
   file may reference them. `access_revoked` is **not** here; it is a realtime
   event only (§12.3).
2. `043_multi_role_conversations` — `user_roles`, provider categories,
   `conversation_participants.presentation_role`,
   `conversations.context_key` (backfilled to `parent:parent` before the
   constraint swap), replacing the pair unique index with
   `(user_a_id, user_b_id, context_key)`. The four call sites in §11.8 ship in
   the same release.
3. `044_circle_threads_and_access` — `circles.chat_seq`, threads, topics,
   grants, membership periods
4. `045_circle_messages_and_reads` — messages, reactions, mentions,
   attachments, read cursors
5. `046_provider_channels` — channels, updates, follows
6. `047_chat_outbox_and_moderation` — event outbox, report targets, checks
7. `048_migrate_posts_to_threads` — idempotent data backfill and mappings

Every file must be appended to `MIGRATIONS` in
`packages/db/src/migrate.ts`. The runner wraps each file in one transaction.
Do not add notification enum values and use them in the same migration.
Apply/query Supabase through `DATABASE_URL`; do not use historical Neon
runtime paths.

Migration `048` must be rerunnable without duplicates using the source
unique keys. Navigation cutover is an application release after migration
validation, not part of the SQL transaction.

---

## 23. Status

| Item | State |
|---|---|
| This contract | Locked; reviewed against the live schema, API routes, and realtime gateway |
| Ordering, migration field mapping, DM context keys | Resolved (§11.3, §11.6, §11.8, §11.13) |
| Curriculum scope, realtime revocation, block behavior, limits, empty states | Resolved (§5.1, §12.3, §15.2, §15.4, §13.3) |
| Existing post data | Migration source; retained read-only for compatibility and audit |
| Old Home/circle-feed/composer navigation | Hidden only after migration validation |
| Threads, group messages, Messages merge, Home chat door, tutor channels, dual-role DMs, discovery Message author | Not built |

Implementation reuses `circles`, current membership, DMs, safety controls,
and discovery ideas. It adds canonical single-circle threads, group messages,
role assignments, thread grants, independent read cursors, provider channels,
and durable event outbox processing. It never invents a second membership
graph and never treats Redis as message storage.
