# Admin chat moderation (hide messages)

## Goal

Give ops a **logged-in admin page** to:

1. Look up a parent (handle like `Parent-MXS3`) or a circle.
2. Read that parent’s messages **across circles**, with replies expanded.
3. **Select** one or more messages and **hide** them.

Parents in the app then see a tombstone, not the original text:

> Blocked as inappropriate

This is **message-level hide**, not deleting the row and not banning the account
in v1. The original body stays in the database for ops/audit. The parent APIs
already withhold `body` and attachments when `status !== 'visible'`.

**This document is the spec.** Do not ship UI until the API, hide semantics,
and parent-visible copy below are followed.

---

## Why this exists

Today:

| Surface | What ops can do |
| --- | --- |
| `/internal/admin/circles.html` | Membership only. No message bodies. |
| `/internal/admin/seeds.html` | Thread titles for seed posting. No hide. |
| `GET /internal/admin/circles/:id/threads` | Title, author, counts. No replies, no body. |
| Parent report endpoints | Store a report. Nothing consumes the queue. |
| Author delete | Author-only, 24h window, copy is “Message deleted”. |

There is **no operational hide**. `circle_messages.status` already allows
`visible | deleted | moderated`, and `mapMessageRow` already redacts
non-visible bodies. Mobile currently collapses every non-visible message to
“Message deleted”. This page is the missing admin writer for `moderated`.

Motivating case: a parent handle (`Parent-MXS3`) is posting badly. Ops need to
see those posts in each circle, read the thread, pick the bad lines, and hide
them without SQL.

---

## Admin URL

Same auth as the rest of ops admin (`ADMIN_LOGIN_EMAIL` /
`ADMIN_LOGIN_PASSWORD`, 12h Bearer, `VaaraAdmin` in
`apps/web/public/internal/admin/admin-auth.js`).

| URL | Purpose |
| --- | --- |
| `/internal/admin/moderation.html` | Canonical page |
| `/admin/moderation.html` | Shortcut (add a Vercel redirect next to the other `/admin/*.html` rules) |

Deep links (bookmarkable):

| Query | Opens |
| --- | --- |
| `?handle=Parent-MXS3` | Parent lookup; lists every circle they posted in |
| `?email=` | Same lookup by email |
| `?userId=` | Same lookup by user id |
| `?circleId=` | Circle channel view (all recent messages, any author) |
| `?threadId=` | Expands that side-thread of replies |
| `?messageId=` | Scrolls to / selects that message after load |

Login bounce already preserves `next` including query string, so
`/internal/admin/login.html?next=/internal/admin/moderation.html?handle=Parent-MXS3`
works.

Add **Moderation** to the shared admin nav on every existing
`/internal/admin/*.html` page.

---

## What ops sees (page layout)

Three panes, same visual family as Circles admin (cream background, teal
actions, danger red only on Hide).

```text
[ Search: handle / email / circle name ]

Circles with hits          Channel messages              Replies
----------------           -----------------             -------
School · Gaudium           ☐ Parent-MXS3  11:02          ☐ Parent-A  11:04
Class · Grade 9 CBSE         “that text…”                  “reply…”
PIN 500019                 ☐ Parent-7F2A  11:05          ☐ Parent-MXS3 11:06
                             “unrelated…”                  “worse text…”
                           ☐ Parent-MXS3  11:10
                             “another post…”

                           [ Hide selected ]  [ Unhide selected ]
```

### Left — search + circles

- Default search is **parent handle** (`Parent-MXS3`).
- Also accept email, user id, circle display name, PIN, school name.
- Left list is **circles that have matching visible or already-hidden
  messages**, with hit counts.
- Selecting a circle loads the middle pane for that circle only.

### Middle — channel (group firehose)

- Chronological **channel messages** (`circle_messages.thread_id IS NULL`),
  newest first, paginated.
- Each row shows: checkbox, handle, time (IST), **full body** (ops must read
  the real text, including already-hidden rows), attachment summary, reply
  count.
- Hidden rows stay in the list with a `hidden` badge. Ops never sees the
  parent tombstone copy in this page.
- Clicking a row with replies opens the right pane.

### Right — replies (side thread)

- Messages with `thread_id` set (Slack-style replies under the channel
  message).
- Same checkbox + full body + IST time.
- Empty state: “No replies”.

### Hide / unhide bar

Always visible once anything is checked.

- **Hide selected** — confirm: “Hide N message(s) in this circle? Parents
  will see: Blocked as inappropriate”
- Optional extra checkbox on confirm: **Also hide replies on selected channel
  messages** (off by default). Hiding a reply never auto-hides the parent
  channel message.
- **Unhide selected** — restore `visible` if ops hid the wrong line.
- Reason stored on the audit row. Default reason: `not_appropriate`.
  Ops can type a longer note; it is **not** shown to parents.

---

## Parent-visible copy

| Message `status` | What parents see in the bubble |
| --- | --- |
| `visible` | Original body + attachments |
| `deleted` | `Message deleted` (author delete, unchanged) |
| `moderated` | `Blocked as inappropriate` |

Rules:

- Same copy for the author and for everyone else. Hide is not a secret mute.
- No original text, quote preview, last-reply preview, or attachment URLs
  leak after hide. (`mapMessageRow` already nulls `body`; attachment hydration
  already skips non-visible ids.)
- Handle / avatar / timestamp stay, so the thread still reads as a conversation.
- Reactions and “reply in thread” are disabled on hidden bubbles (same as
  today’s deleted bubbles).
- Home / inbox preview that would have used a now-hidden body must show the
  tombstone string or skip that message, never the original.

Do **not** use `circle_threads.status = 'moderated'` for this v1 hide.
That status currently makes the whole thread unreadable (`canRead` is false,
Home queries require `status = 'open'`). Ops asked to **see a blocked
placeholder in place**, not a 404. Thread-level takedown is a later action.

---

## Hide semantics (data)

Reuse existing columns. No new status enum.

On hide, in one transaction per request:

1. `UPDATE circle_messages SET status = 'moderated' WHERE id = ANY($ids) AND status = 'visible'`
2. Do **not** null `body`. Admin and audit still need it.
3. Do **not** delete `circle_message_media` rows. Parent APIs already omit
   attachments for non-visible messages; object cleanup can stay on the
   existing deleted-message path later.
4. If a hidden message is used as `last_reply_preview` / Home preview, those
   queries already filter `m.status = 'visible'` in most places — audit them
   as part of implementation so nothing still reads `body` from a moderated
   row.
5. Insert an audit row (actor email, reason, message ids, circle ids).

On unhide:

1. `status = 'visible'` only if current status is `moderated`.
2. Do not unhide author-`deleted` messages from this page.
3. Audit the restore.

Attachments: hidden with the message. No separate “hide photo only” in v1.

---

## What v1 does **not** do

| Action | v1 |
| --- | --- |
| Suspend the profile | Yes. `users.content_blocked` stops group, thread, and DM sends. Parents see **This profile is suspended**. |
| Remove the parent from circles | No. Membership follows the child profile. |
| Hide 1:1 DMs | No. Group/channel + thread replies only. |
| Auto-hide every message by that parent | No. Ops selects rows. A later “Hide all from this parent in this circle” is allowed as a convenience **after** the list is on screen, still with confirm. |
| Consume the reports queue | No. Reports stay a later inbox. |
| Volunteer / school admins | No. Platform ops only. |

A bulk “hide all visible messages by this parent (all circles)” can be a
confirm-gated button on the parent lookup header **after** the per-message
flow works. It is not the first control on the page.

---

## API (admin login session, or `X-Admin-Secret`)

All under `/internal/admin`. Same `requireAdminAuth` as Circles / Seeds.

### Lookup

`GET /internal/admin/moderation/search?q=Parent-MXS3`

`q` matches `anonymous_handle`, email, user id, circle display name, circle
key, PIN, school name.

Returns:

- `parents[]` — id, email, anonymous_handle, display_name, created_ist
- `circles[]` — id, type, display_name, hit_count (for the selected parent or
  text query)

### Parent across circles

`GET /internal/admin/moderation/parents/:userId/circles`

Returns each circle the user has channel messages or replies in, with
`visible_count` and `moderated_count`.

### Channel page

`GET /internal/admin/moderation/circles/:circleId/messages?authorId=&beforeSeq=&limit=`

Admin read of the firehose. **Includes** `deleted` and `moderated` rows, with
`body` intact. `authorId` filters to one parent (used after handle lookup).

Each item: id, seq, status, body, created_ist, author (id, handle, email),
reply_count, attachment_count, thread_id (null for channel),
`side_thread_id` when replies exist.

### Replies

`GET /internal/admin/moderation/messages/:messageId/replies`

Side-thread replies for that channel message, including hidden ones, bodies
intact.

### Hide / unhide

`POST /internal/admin/moderation/messages/hide`

```json
{
  "messageIds": ["uuid", "uuid"],
  "reason": "not_appropriate",
  "note": "optional ops note",
  "includeReplies": false
}
```

`POST /internal/admin/moderation/messages/unhide` — same `messageIds`.

Both return `{ ok, updated, skipped }` where `skipped` are ids that were not
`visible` (hide) or not `moderated` (unhide).

Cap `messageIds` at 100 per call.

### Audit

Reuse a dedicated table rather than `admin_seed_actions`:

```sql
CREATE TABLE admin_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,           -- hide | unhide
  actor text,                     -- admin email
  reason text,
  note text,
  message_ids uuid[] NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`GET /internal/admin/moderation/actions?limit=50` for a recent-actions strip
on the page.

---

## App / API changes required with the page

The HTML page is not enough on its own.

1. **Mobile tombstone** — `ChatThreadScreen` Bubble: if `status === 'moderated'`
   show `Blocked as inappropriate`; keep `Message deleted`
   for `deleted` only.
2. **Preview leak check** — any `LEFT(r.body)` / `t.body` / `t.title` used for
   last-reply or Home preview must ignore `moderated` the same way they ignore
   non-visible, or substitute the tombstone string.
3. **Realtime** — after hide, publish the existing message-updated/deleted
   style event so an open chat replaces the bubble without a restart. If no
   event exists yet, refresh-on-focus is acceptable for v1; document which.
4. **Vercel redirect** — `/admin/moderation.html` →
   `/internal/admin/moderation.html`.

Hide does not stop new sends. Use **Suspend profile** (`users.content_blocked`)
for that. The parent can still read.

---

## Security

- Admin JWT or `X-Admin-Secret` only. No parent JWT.
- Hide endpoints never return to `/v1/chat/*`.
- Admin responses **may** include email and original body. They must not be
  cached on a CDN.
- Do not log full message bodies to Vercel/Datadog in hide handlers; log ids
  and actor only.
- `noindex,nofollow` on the HTML page, same as other admin pages.

---

## Phased delivery

### Phase 0 — this doc

- Confirm tombstone copy (locked below unless product changes it).
- Confirm hide is per-message, not auto-ban.

### Phase 1 — hide one message

- [x] Migration `061_admin_moderation_actions` (audit table only)
- [x] Search + parent-across-circles + channel + replies GET endpoints
- [x] Hide / unhide POST
- [x] `/internal/admin/moderation.html` + nav + `/admin/moderation.html` redirect
- [x] Mobile moderated tombstone copy
- [x] Preview leak check

### Phase 2 — faster ops

- [ ] “Hide all from this parent in **this** circle” (confirm)
- [ ] Deep link from Circles member row / Parent signups
- [ ] Recent audit strip on the page

### Phase 3 — later, not this page’s job

- [x] Profile suspension (`content_blocked`) so they cannot send more
- [ ] Reports queue
- [ ] Thread-level takedown (`circle_threads.status = 'moderated'`) if we ever
      want the whole topic gone instead of a tombstone

---

## Ops playbook (once shipped)

1. Open `https://<web-host>/internal/admin/moderation.html?handle=Parent-MXS3`
   (or `/admin/moderation.html?handle=Parent-MXS3`).
2. Confirm the parent (email + handle).
3. Open each circle in the left list.
4. Expand replies on anything with a reply count.
5. Check the bad channel messages and/or replies.
6. **Hide selected** → confirm.
7. Spot-check the circle in the app: bubble shows
   **Blocked as inappropriate**.
8. Use **Suspend profile** on the parent header to stop new group, thread, and
   DM sends. The app shows **This profile is suspended**. Migration `062` also
   sets this for `Parent-MXS3`.

---

## Locked decisions

1. **Tombstone copy:** `Blocked as inappropriate` (short enough for a chat
   bubble; same job as “Message deleted”)
2. **Author-delete copy stays:** `Message deleted`
3. **v1 action:** select and hide messages. Ops can also **suspend the profile**
   so they cannot send new group, thread, or DM messages.
4. **Admin always sees original text**, including after hide.
5. **Thread stays open.** Replies from other parents remain unless also
   selected.

## Open only if we hit them in build

1. Realtime: hide publishes `chat.message` and the open chat **refetches** the
   thread so the tombstone appears without a restart.
2. Whether Phase 2 “hide all in this circle” is needed before the first hide
   of `Parent-MXS3`. Per-message select is enough for the first incident.
