# Slack-style threads — release remediation plan

**Status:** Remediation in progress — migration `052` corrected; API/mobile
fixes landed for access, unread, lifecycle, and core UX. Full pagination and
integration suite still remaining.
**Date:** 18 September 2026.
**Parent decision:** `docs/SLACK_STYLE_THREADS.md`.

---

## 1. Architecture clarification: circle vs channel

For v1:

```text
one circle (membership / audience boundary)
└── one main channel (chronological messages)
    ├── message
    │   └── one flat thread of replies
    └── message
```

A circle does **not** contain multiple named channels in v1. The circle and its
main channel therefore look like one object in the mobile app, but they have
different responsibilities:

- **Circle:** who belongs, circle type, school/PIN/curriculum metadata.
- **Channel:** the main chronological message stream for that circle.
- **Thread:** a focused side conversation under one channel message.

Future named channels would require a separate `circle_channels` table and a
`channel_id` on messages. That is explicitly out of scope.

---

## 2. Release gate

Do **not** run the committed form of `052_slack_style_threads.sql`.

Read-only Supabase preflight on 18 September 2026:

- schema migration latest: `051_preschool_onboarding`;
- `052` columns are not present;
- 8 existing `circle_threads`;
- 3 `school_class` threads already have a linear root created by migration
  `050`;
- 1 reply was detached into the school-class channel by migration `050`;
- the other 5 legacy threads have no root message yet;
- all 5 non-school-class threads have an unused `created_seq` that can be
  reused safely for their root message.

Because `052` has not been applied to Supabase, edit `052` in place before
deployment. If another environment has already applied the old form, use a
separate repair migration there; do not rewrite its migration history.

---

## 3. Migration correction: reuse old roots, do not delete them

### Decision

The three messages created by migration `050` are the valid channel roots.
Do **not** delete them and then create replacements. They preserve:

- original message identity;
- original `created_at`;
- original `created_seq`;
- copied media;
- existing source-post mapping.

Migration `052` must recognize and reuse them.

### Corrected migration algorithm

Run all steps in the migration transaction:

1. Add `circle_threads.root_message_id` and
   `circle_messages.parent_message_id`.
2. For a legacy thread with `source_post_id`, find an existing channel message
   where:
   - circle IDs match;
   - `thread_id IS NULL`;
   - `source_post_id` matches.
3. Set that message as `circle_threads.root_message_id`.
4. Reattach replies flattened by migration `050`:
   - identify them by matching circle, `source_reply_id`, and their
     `reply_to_message_id` pointing at the reused root;
   - restore `thread_id`;
   - set `parent_message_id` to the reused root;
   - clear `reply_to_message_id` when it only represented the old root link.
5. Only for threads still lacking a root, insert one using:
   - `seq = circle_threads.created_seq`;
   - `created_at = circle_threads.created_at`;
   - original author, role and body/title;
   - no new `chat_seq` allocation.
6. Set `parent_message_id` on every existing attached reply.
7. Recompute each thread’s `reply_count`, `last_activity_seq` and
   `last_message_at` from visible replies plus its root.
8. Set each circle’s `chat_seq` to at least the maximum thread/message
   sequence.
9. Add constraints only after the backfill succeeds.

### Required postconditions

Abort the migration unless all are true:

- every non-deleted thread has exactly one root;
- every root belongs to the thread’s circle;
- no two threads share a root;
- every reply’s `parent_message_id` equals its thread’s root;
- no reply points at another reply as its parent;
- no duplicate `(circle_id, source_post_id)` roots;
- original thread timestamps are preserved;
- expected reply counts before and after migration match;
- no message sequence exceeds its circle’s `chat_seq`.

### Recovery if old `052` ran elsewhere

Do not delete by body text. Identify duplicates through
`source_post_id`/thread/root relationships. Keep the migration-`050` message,
move replies and `root_message_id` to it, verify media/source mappings, and
only then soft-delete the generated duplicate.

Implement that recovery as a separate, idempotent `053` only in environments
that already recorded the old `052`. It must also repoint reactions, mentions,
message media, reports and notification/outbox message IDs before removing a
duplicate. Supabase has not recorded `052`, so its correct path is still to fix
`052` before first application rather than intentionally apply broken SQL and
repair it afterward.

---

## 4. Own guest question must start as read

### Current failure

A parent asks another school a question, returns to Messages, and sees an
unread badge on their own question before anyone replies. With zero replies,
opening the thread cannot clear the badge because mobile only marks the maximum
reply sequence.

### Fix

- When creating a thread, auto-follow its author with
  `last_read_seq = root message seq`.
- Do the same for the guest author.
- Thread read updates must use:
  `last_read_seq = GREATEST(existing, requested)`.
- Opening a zero-reply thread may also mark through
  `thread.last_activity_seq`, but creation-time initialization remains the
  authoritative fix.
- Do not count the viewer’s own root/message as unread.

### Acceptance

- A newly submitted guest question has unread count 0.
- The first reply changes it to 1.
- Opening the thread clears it.
- A delayed read request from another device cannot make it unread again.

---

## 5. Unread rules for every circle channel

### Decision

Every circle type has one main channel:

- `school_class`
- `class`
- `school`
- `community`
- `locality`
- `curriculum`
- future preschool/age circles

Inbox unread must not special-case `school_class`.

### Fix

For every group inbox row calculate two independent values:

1. **Channel unread:** visible channel messages after
   `circle_chat_reads.last_read_message_seq`, excluding the viewer’s own
   messages and respecting membership period and blocks.
2. **Thread unread:** followed/authored/participated threads whose
   `last_activity_seq` is newer than the viewer’s monotonic
   `circle_thread_reads.last_read_seq`.

The displayed group badge is their sum. A root message belongs to channel
unread; its replies belong to thread unread, so do not count the same event
twice.

The inbox preview/order must choose the actually newest timestamp between
channel and thread activity. `COALESCE(linear, thread)` is insufficient because
it always chooses linear whenever any channel message exists.

### Acceptance

- A new direct message in any circle’s channel adds an unread badge.
- A followed thread reply adds thread unread without becoming a separate
  channel message.
- Own sends do not create unread.
- Opening only the channel clears channel unread, not unopened thread replies.
- Inbox preview and order reflect whichever activity is newest.

---

## 6. Live thread reply counts in an open channel

### Current failure

The root displays “2 replies.” A third reply arrives while the channel is open.
Realtime catch-up requests channel messages after the latest sequence; the new
row is a thread reply and is correctly excluded, so no channel row is returned.
The cached root remains at “2 replies.”

### Fix

- Include `threadId` and `rootMessageId` in thread-reply realtime events.
- On a circle screen receiving a thread event:
  - patch the matching cached root from event data, or
  - fetch/invalidate that root/channel query.
- A simple safe v1 implementation is to invalidate the channel query whenever
  a circle event contains `threadId`.
- Keep the thread screen’s own catch-up unchanged.
- Replace manual `reply_count + 1` bookkeeping with a database summary
  function/trigger that recomputes count and latest visible activity on reply
  insert, reassignment, moderation or deletion. This also keeps imports and
  migration repairs consistent.

### Acceptance

With two devices open, a reply on device A changes device B’s root count and
last-reply preview without leaving or manually refreshing the channel.

---

## 7. Guest access, revocation and moderation

### Locked v1 policy

Guest asking remains thread-only:

- the parent never joins the school circle;
- `guest_author` grants access only to that one thread;
- the grant has no automatic expiry;
- closing a thread makes it read-only but still readable;
- deleting or moderating a thread makes it unavailable to normal users;
- blocks continue to deny interaction/content in both directions.

The distinction is intentional:

- **Close** means “stop new replies, but let participants keep the
  conversation.” It is the normal author-controlled read-only action.
- **Revoke** means “this person must no longer have access.” It is an audited
  safety action, so retaining owner-read access after revocation would defeat
  its purpose.
- **Moderate** means the content itself was removed by safety staff. It is
  redacted for every non-moderator, including its author.

### Who can revoke

Manual guest invite/revoke is not a v1 product feature. Therefore:

- ordinary school-circle members must **not** be able to revoke a guest;
- remove/disable the public generic grant and revoke endpoints for v1, or
  restrict them to a future audited moderator capability;
- a guest author closes their own thread rather than revoking their own grant;
- safety/admin moderation must use a separate authenticated internal operation
  with actor, reason and timestamp.

There is currently no operational chat-moderation API: reports are stored, but
`internal.ts` only exposes school-catalog moderation. The release fix must add
report listing and transactional thread/message moderation endpoints before
the product claims that revocation or moderation is supported.

### Access rules

`authorId === userId` must not bypass a revoked guest grant.

For a non-member guest author:

```text
read = active guest grant AND status in (open, closed) AND not blocked
reply = active reply grant AND status = open AND not blocked
```

Member access:

```text
read = current membership AND status in (open, closed) AND not blocked
reply = current membership AND status = open AND not blocked
```

`moderated` and `deleted` return 404 to normal member, guest and discovery
routes. Moderation staff use a separate audit surface.

The public thread PATCH route may transition only `open ↔ closed`. It must
reject attempts to reopen a thread whose current status is `moderated` or
`deleted`; today an author can change a moderated row back to `open`.

### Durable Guest identity

The Guest badge describes how each message was authored, not whether a grant
is active today. Add an immutable author context to messages (for example,
`is_guest_author boolean NOT NULL DEFAULT false`) and set it at write time.
Do not derive historical badges only from a currently active grant.

### Revocation/moderation side effects

In one transaction:

- revoke the grant or set root/thread moderation status;
- store `revoked_by`, reason and timestamp in an audit record;
- prevent further reads/replies;
- suppress Home/inbox/notification delivery as appropriate;
- enqueue an `access.revoked` event for that user/thread.

After commit, realtime disconnects the thread room and mobile replaces the
thread with a clear unavailable/moderated state. The current revoke route does
not publish this event and must not be shipped as-is.

The realtime gateway must also authorize subscriptions using current thread
status, blocks, grant expiry and revocation—not membership/grant existence
alone. `access.revoked` must reach the active thread room before that
subscription is dropped; publishing only to the inbox channel does not update
the open thread screen reliably.

Grant storage must support an audited restore/regrant. The current composite
primary key plus `ON CONFLICT DO NOTHING` leaves a revoked row in place and
silently prevents the same role from being granted again. Use a grant-event
audit table or a surrogate grant ID plus one partial unique index for an active
grant.

Thread reports must require current read access, reject self-reporting, and
deduplicate repeated reports. Add message-level reporting using
`target_circle_message_id`; that database field exists but no API/UI currently
uses it.

### Acceptance

- No ordinary member can silence a guest author.
- Admin revocation immediately blocks direct-link read and reply.
- Closed threads remain readable and read-only.
- Moderated/deleted threads expose no body through direct URLs.
- Past guest messages retain the Guest badge after revoke.
- Authors cannot reopen moderated/deleted threads.
- Revoked/expired users lose realtime delivery and pending notifications.

---

## 8. Root/thread lifecycle synchronization

### Current failure

The root content exists in both `circle_messages` and `circle_threads`.
Editing/deleting only one side makes channel, thread header, Home and inbox
disagree.

### Decision

The root `circle_messages` row is canonical for message body, author, status and
timestamps. `circle_threads` remains the thread identity and stores thread
metadata such as title, kind, visibility, reply count and activity.

### Fix

- Thread GET/Home/inbox should read root body/status through
  `root_message_id`; avoid treating a stale `circle_threads.body` as canonical.
- Editing a root updates the root and any retained denormalized thread preview
  in one transaction.
- Editing thread title/body through the legacy thread route updates its root in
  the same transaction.
- Deleting a root:
  - soft-deletes/hides the root body;
  - closes its thread immediately;
  - leaves existing replies read-only for members unless moderation requires
    full removal.
- Moderating a root marks both root and thread moderated and hides both.
- Deleting/moderating an individual reply recomputes visible `reply_count`,
  `last_activity_seq`, `last_message_at` and preview.
- Emit one outbox/realtime event after the transaction.

### Acceptance

- Edited root text is identical in channel, thread header, Home and inbox.
- Deleted root cannot retain an open composer.
- Moderated root/thread content cannot be retrieved by direct URL.
- Reply count always equals visible replies.

---

## 9. Follow and notification semantics

### Decision

- Root/thread author: auto-follow.
- Guest author: auto-follow and cannot unfollow while the guest grant is the
  only inbox path; mute remains available.
- Anyone who posts a reply: auto-follow.
- Provider responder: auto-follow when granted/opened or on first reply.
- Mere viewer: do not auto-follow silently.
- Members get explicit Follow/Unfollow UI.
- Mute suppresses notifications but does not revoke access.
- Explicit unfollow wins over later automatic behavior.

### Fix

- Call `followThread` transactionally after every successful first reply.
- Add an explicit-follow choice marker (for example `follow_explicit`) so an
  automatic author/replier follow never reverses a deliberate unfollow.
- `POST /follow` records explicit follow; `DELETE /follow` records explicit
  unfollow.
- Initialize author read sequence to the authored/root sequence.
- Add Follow/Unfollow control to the thread header.
- Notify active, unmuted followers/participants only, excluding sender and
  blocked/revoked users.
- Realtime inbox updates may reach members for badge refresh, but push/thread
  notifications must not go to the whole circle.
- Load recipient push tokens and notification preferences before calling
  `batchCreateNotifications`; passing only user IDs creates in-app
  notifications but no push-outbox rows.
- Check `expires_at` as well as `revoked_at` when selecting realtime inbox
  recipients.
- Deliver each transactional outbox event once. Routes currently publish an
  immediate nudge and the outbox publishes the same nudge again; choose the
  durable outbox as the source of truth and make workers claim rows safely.

### Acceptance

- A member who replies receives later replies.
- A provider responder receives the parent’s follow-up.
- A viewer who did not follow or reply receives no thread push.
- Muted, blocked and revoked users receive no thread notification.
- A thread reply produces the expected push-outbox row when preferences allow
  it.
- One committed message produces one logical realtime notification, even with
  multiple outbox workers.

---

## 10. Thread screen errors and pagination

### Errors

- Unauthorized group reads return 403/404 instead of a successful empty list.
- Validate UUIDs, JSON bodies, positive integer cursors and limits; reject a
  request that supplies both `beforeSeq` and `afterSeq`.
- Keep guest quota increments in the same transaction as successful creation.
- Make concurrent “start thread” requests converge on the unique existing
  thread rather than surfacing a uniqueness error/500.
- Validate that an idempotent `client_message_id` retry targets the same circle
  and thread before returning the prior message.
- Do not default `canReply` to true while thread metadata is missing.
- Show loading until access metadata and the first message page resolve.
- Map 403/404/revocation to “This thread is no longer available.”
- Map `closed` to a readable thread with no composer.
- Show an inline retry state for network/server errors.
- Catch and display failures for send, create/open thread, mute, follow,
  reaction, edit, delete and Message author.
- Add an in-flight guard to “Ask this school” so rapid taps cannot create
  duplicate guest questions.

### Pagination

- Convert channel/thread history to an infinite query.
- Fetch `limit + 1` server-side and return explicit direction/has-more state;
  accept only one pagination direction per request.
- Load `beforeSeq=nextCursor` when scrolling toward older history.
- Deduplicate by message ID and preserve ascending visual order.
- Realtime catch-up continues with `afterSeq=maxLoadedSeq`.
- Preserve scroll position while prepending older pages.

### Acceptance

- Invalid/revoked links never show an empty writable composer.
- Send failures preserve the draft and show an actionable error.
- Histories longer than 40 messages can reach the oldest permitted message.
- Realtime catch-up loops while newer pages remain, so bursts larger than one
  page do not lose messages.
- Rapid taps create one school question.

---

## 11. Integration coverage required

The existing chat journey test is environment-gated and currently skipped.
Release needs an active CI database suite covering:

### Migration

- fresh schema through `052`;
- upgrade from `050` fixture with existing school-class roots/replies/media;
- upgrade with non-school-class threads;
- rerun/idempotency behavior;
- all postconditions in §3.

### Access and moderation

- member channel/thread read and reply;
- guest author can read/reply only to their granted school thread;
- guest cannot open the school channel or another thread;
- class/grade guest ask rejected;
- revoke denies direct read/reply and sends access event;
- closed is read-only;
- moderated/deleted is unavailable;
- Guest badge survives revoke;
- blocks suppress content and notifications.

### Unread/realtime/notifications

- own guest question starts read;
- first external reply becomes unread and clears on open;
- channel unread works for every circle type;
- read cursors never regress;
- root reply count/preview updates live;
- authors/repliers/providers follow correctly;
- mute/revoke suppress notifications.

### Lifecycle and pagination

- root edit/delete/moderation stays synchronized;
- reply deletion recomputes counters;
- concurrent start-thread calls return the same thread, not 500;
- idempotent message retry validates the same circle/thread destination;
- more than 40 messages paginate without gaps or duplicates.

The suite must run in CI rather than report `SKIP`. A release should fail if the
migration fixture or any access/unread lifecycle case fails.

---

## 12. Implementation order

1. Rewrite and test migration `052`; run read-only preflight, apply to a
   disposable database copy, verify postconditions. **Done in repo** —
   corrected SQL not yet applied to Supabase.
2. Fix access rules for revoke/moderated/deleted and disable public member
   revocation. **Done in API.**
3. Make root/thread lifecycle transactional and Guest identity durable.
   **Done in API + migration (`author_was_guest`).**
4. Fix monotonic read state and all-circle unread aggregation. **Done in API.**
5. Refresh channel roots on thread realtime events. **Done in mobile (refetch
   on `threadId` events).**
6. Implement explicit follow/notification rules. **Done in API
   (`follow_explicit` + push-token notifications).**
7. Add mobile error states, duplicate-submit guard and pagination.
   **Error states + Ask guard done; infinite history pagination still open.**
8. Enable the full integration suite. **Still open.**
9. Only then apply corrected `052` to Supabase and ship API/mobile together.

