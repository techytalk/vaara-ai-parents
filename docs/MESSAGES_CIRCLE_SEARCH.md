# Messages: search a circle and send

A parent can look up a circle they do not belong to, open it, and send one
message. The message is a guest thread in that circle. They do not join the
circle.

This is separate from **New message**, which finds a parent for a private
chat. Search circles finds groups.

Related: `docs/SLACK_STYLE_THREADS.md` §3.2 (guest thread rules).

## What the parent does

1. Open **Messages**.
2. Choose **Search circles**.
3. Type a school, area, pin, curriculum, or community.
4. Tap one result. The composer is for that circle only.
5. Write one message and send.

The thread then shows under **Your questions**, labeled **Guest**, with that
circle’s name. Replies from parents in the circle appear on that same thread.

## Which circles search returns

Search has two result sections:

- **Your groups** contains circles the parent already belongs to. Tapping one
  opens the full group; it never creates a guest thread.
- **Other circles** contains circles the parent does not belong to and that
  accept guest questions. Tapping one opens the guest composer.

Guest search/send uses an explicit allowlist. Do not rely on
`accepts_guest_posts` alone, because that column currently defaults to true.

| What the parent is looking for | `circle_type` | Guest search/send |
|---|---|---|
| A school | `school` | Yes |
| An area or pin | `locality` | Yes |
| A curriculum | `curriculum` | Yes |
| A board and grade, not one school | `class` | Yes |
| A community or apartment | `community` | Yes |
| One class at one school | `school_class` | No — members only |
| One age group at one school | `school_age` | No — members only |
| One age group in a locality | `age_locality` | No — members only |

The API must reject a `type` query outside the same allowlist. Supplying
`type=school_class`, for example, must not bypass the default exclusion.

The query matches the circle name and, when present, school name, city,
locality, curriculum, grade label, community name, and circle key.

Results need cursor pagination. The present fixed limit of 50 is not a complete
result set for broad searches such as CBSE or Hyderabad.

## What send does

The message is created in the chosen circle as a guest thread. Parents who
belong to that circle see it there and reply on that thread. Nothing else
about the circle is opened for the asker.

| The asker gets | The asker does not get |
|---|---|
| That thread, including every reply | The rest of the circle’s messages |
| A row under Your questions | The circle in Your groups |
| The ability to reply while the thread is open | The member list |
| Thread-reply notifications, unless muted | A private chat with a member from this flow |

Other rules, already locked for guest questions:

- The asker is any parent-role account. No shared pin, city, or school is required.
- The author is their anonymous handle plus a **Guest** badge.
- They are not added to `circle_members`. Access is a `guest_author` grant on that thread.
- Five guest questions per day, calculated in the parent's timezone.
- V1 guest questions are text-only. The composer must not imply that
  attachments, polls, or documents are supported.
- Blocks, the content guard, reports, and moderation still apply.

## Reports and abusive guest questions

No parent is a circle admin or moderator. A circle member may report a guest
question, but cannot hide it, revoke its author, or remove that parent.

Only authenticated Vaara staff using **Admin → Moderation** can take moderation
action. **Remove guest question** is one atomic admin action:

1. Mark the thread `moderated`.
2. Mark its root and replies `moderated`.
3. Set `revoked_at` on every active `guest_author` grant for the thread.
4. Publish `access.revoked` to the guest author's user inbox and evict any
   active thread subscription.
5. Remove the thread from **Your questions** and invalidate its cached pages.
6. Deny the guest read, reply, edit, delete, close, follow, mute, and read-state
   routes for that thread.

The guest's already stored content remains available to Vaara staff for audit.
Circle parents no longer see it. Suspending the parent's posting ability is a
separate Vaara-admin action for repeated or severe abuse; it is not automatic
for every removed question.

If Vaara staff restore the question, restore the thread/root/replies together,
reactivate the guest-author grant, and notify/invalidate the same surfaces.

## What is already built

| Piece | State |
|---|---|
| Directory search for the circle types above | Built. `GET /v1/circles/directory` |
| Guest message into a whole-school circle | Built. `POST /v1/circles/:circleId/guest-threads`, and **Ask this school** on the school page |
| Inbox row for that thread | Built. Messages → Your questions |
| Guest message into locality, curriculum, community, or board-and-grade (`class`) | Built. Same guest-thread allowlist as search |
| Messages → Search circles → tap → send | Built. `GET /v1/chat/circle-search` + mobile Search circles / Ask as guest |
| Vaara Admin → Remove / restore guest question | Built. Atomic moderation action + internal Admin UI |

School-class, school-age, and age-locality circles remain out of guest search
and guest send.
