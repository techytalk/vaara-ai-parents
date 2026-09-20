# Internal seed parents (circle warm-start)

## Goal

For each target circle (especially **school** and later **curriculum / class**), keep **two internal parent accounts**:

| Role | Job |
| --- | --- |
| **Asker** | Posts questions / icebreakers that real parents can answer |
| **Responder** | Replies and posts answers so the circle never looks empty |

Intent: when early real parents open a school/curriculum circle, they already see activity. Once organic conversation is healthy, ops can **deactivate** (or later remove) these accounts without deleting history by default.

This is separate from:

- Automated **test** emails (`@vaara.test`, `@example.com`, …) — filtered by “Hide test emails”
- Store review logins (`playstore.review@vaara.ai`, `apple.review@vaara.ai`) — keep unless explicitly included

---

## Core invariant

An **active internal parent behaves exactly like a normal parent** everywhere in
the product:

- same circle membership and discovery rules
- same post, reply, reaction, thread, and moderation behavior
- same feed and realtime behavior
- same push and in-app notification behavior
- same rate limits, content guards, and permissions
- same author presentation to other parents

`is_internal` is an **admin-only operational marker**. It must not create a
separate product role or alternate chat/feed path. The only additional
capabilities are:

1. an admin can create (spawn) the account;
2. an admin can post as the account through the existing posting pipeline;
3. an admin can activate or deactivate the account; and
4. admin reporting can include or exclude internal accounts.

No mobile API response should expose `is_internal`, `internal_kind`, or
`internal_spawn_key` to regular users.

---

## Product rules

1. **Marked internal** — every seed account has `is_internal = true` (new column). Admin Circles UI shows an `internal` badge; counts get a “Hide internal” toggle (alongside Hide test).
2. **Real membership** — seed accounts go through the same location + child + `syncCircleMembership` path as parents, so they land in the same school / class / curriculum / PIN circles.
3. **Post as them** — admins create threads/replies **as** a chosen internal user through the same chat services used by the app. The resulting content, realtime events, notifications, moderation, and permissions are identical to normal parent activity.
4. **Activate / deactivate** — deactivated accounts:
   - Cannot log in and all existing sessions/tokens are invalidated
   - Cannot post through admin
   - Do not receive new notifications while inactive
   - Still exist in DB
   - Keep memberships and existing posts/replies so conversation history is unchanged
   - Can be reactivated without reconstructing their profile or memberships
5. **Idempotent spawn** — spawning twice for the same school + role must not create duplicates; return the existing pair.
6. **Tomorrow: curriculum** — same spawn flow with target = curriculum (or school_class), not only school.

---

## Suggested account shape

### Email convention

```
internal.{role}.{scope}.{slug}@vaara.ai
```

Examples:

- `internal.ask.school.gaudium-kollur@vaara.ai`
- `internal.reply.school.gaudium-kollur@vaara.ai`
- `internal.ask.curr.cbse@vaara.ai`
- `internal.reply.curr.cbse@vaara.ai`

Display names:

- Use the same display-name and anonymous-handle rules as normal parents.
- Internal role (`asker` / `responder`) is shown only in admin.

Use normal `anonymous_handle` generation so the app UI stays consistent with real parents.

### Password

- Random high-entropy password stored hashed, using the normal parent account format
- Admins do **not** need the password day-to-day — they post through admin
- Do not expose or reveal the password after creation

### Profile completeness

On spawn, set:

- `role = parent`
- `onboarding_complete = true`
- `is_internal = true`
- `internal_status = 'active' | 'inactive'`
- `user_locations` matching the target school’s city/PIN when known (or a chosen PIN for curriculum-wide seeds)
- one `children` row with school (+ curriculum/grade when spawning for class/curriculum)
- run `syncCircleMembership(userId)` so circles match a real parent

---

## Schema (proposed)

Migration additions on `users`:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_status text NOT NULL DEFAULT 'active'
    CHECK (internal_status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS internal_kind text
    CHECK (internal_kind IS NULL OR internal_kind IN ('asker', 'responder', 'review', 'other')),
  ADD COLUMN IF NOT EXISTS internal_spawn_key text UNIQUE;
```

- `internal_spawn_key` — stable idempotency key, e.g. `school:{school_id}:asker`
- Index: `(is_internal, internal_status)` for admin lists

Auth/session changes:

- reject login when `is_internal AND internal_status = 'inactive'`;
- invalidate already-issued tokens immediately on deactivation (session version
  or DB-backed account-status check);
- reject admin post-as actions while inactive; and
- active internal users otherwise pass through normal parent authorization.

Circles admin filters already exclude test emails; add:

- `excludeInternal=1` (default on for “real parent” view)
- badge `internal` on member rows

---

## Admin UX (Circles page + tools)

### A. Circles list (existing)

Per school (and later curriculum) row actions:

1. **Spawn pair** — creates asker + responder if missing  
2. **View internal** — shows the two accounts and status  
3. **Activate / Deactivate** — toggles `internal_status`

Member panel:

- Badge: `internal` + `asker`/`responder`
- Filter checkbox: **Hide internal** (default checked for organic metrics)

### B. “Post as internal” panel (new section on Circles or `seed.html`)

1. Pick circle (or pick school → auto school circle)  
2. Pick internal account (asker / responder)  
3. Compose question or reply  
4. Submit → API creates message/thread **as that user** via existing `createThread` / message services  

Optional later: canned prompt library (“Anyone have bus experience?”, “How is homework load in Grade 6?”).

### C. Batch spawn (tomorrow)

- Target: **all schools with ≥ N real parents** or **selected curriculum**
- Creates missing pairs only
- Dry-run mode listing what would be created

---

## API (admin login session, or optional `X-Admin-Secret`)

Ops pages use **email + password** (`ADMIN_LOGIN_EMAIL` / `ADMIN_LOGIN_PASSWORD`).
Browser sends `Authorization: Bearer <admin JWT>` (12h). Scripts may use `X-Admin-Secret` = `ADMIN_API_SECRET`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/internal/admin/login` | `{ email, password }` → `{ token }` |
| `GET` | `/internal/admin/me` | Validate session |
| `POST` | `/internal/admin/seed/spawn` | Body: `{ target: 'school'\|'curriculum'\|'school_class', schoolId?, curriculumId?, gradeId?, pinCode? }` → `{ asker, responder }` |
| `GET` | `/internal/admin/seed` | List internal users + status + spawn keys |
| `POST` | `/internal/admin/seed/:userId/status` | `{ status: 'active'\|'inactive' }` |
| `POST` | `/internal/admin/seed/:userId/post` | `{ circleId, body, kind?: 'question'\|'reply', parentMessageId? }` |
| `GET` | `/internal/admin/circles?excludeInternal=1` | Extend existing circles admin |

Spawn implementation sketch:

1. Resolve target school / curriculum / grade  
2. For each role `asker` | `responder`:  
   - `spawn_key = "{target}:{id}:{role}"`  
   - upsert user if missing  
   - upsert location + child  
   - `syncCircleMembership`  
3. Return both users  

Post-as: the authenticated admin action calls the existing chat service with
`authorId = seedUserId`. It must not issue a long-lived parent JWT to the
browser or insert chat rows directly. Membership checks, content guards, rate
limits, outbox, realtime, notifications, and thread-follow behavior remain the
same as a normal app post.

---

## Deactivate vs delete

| Action | Login | Circles membership | Existing posts | Counts (Hide internal off) |
| --- | --- | --- | --- | --- |
| **Active** | Allowed | Yes | Visible | Included |
| **Inactive** | Blocked; tokens revoked | Keep | Keep | Included unless admin selects “active only” |
| **Delete** (rare) | — | Remove | Soft-delete or reassign — **avoid** early |

Hard deletion is not part of the normal lifecycle. Deactivate/reactivate is the
supported operation so authored history remains intact.

The **Hide internal** checkbox is an admin analytics/reporting filter only. It
must not affect what normal parents see in the app.

---

## Phased delivery

### Phase 0 — Document + decide (this doc)

- Confirm email domain `@vaara.ai`
- Confirm 2 roles per school first; curriculum next
- Confirm deactivate keeps posts

### Phase 1 — Data model + spawn API

- [x] Migration `is_internal` / `internal_status` / `internal_spawn_key` / `session_version`
- [x] Mark existing `playstore.review@` / `apple.review@` as `is_internal` + `internal_kind = 'review'`
- [x] `POST /seed/spawn` for **school** (also supports curriculum / school_class)
- [x] Circles admin: Spawn pair + Activate/Deactivate + Hide internal

### Phase 2 — Post as

- [x] Admin compose UI + `POST /seed/:id/post`
- [x] Uses the existing circle message/thread pipeline; realtime and notifications behave exactly like a real parent

### Phase 3 — Curriculum / class batch

- [x] Gap check + max-overlap spawn suggestions (`GET /internal/admin/seed/gaps`)
- [ ] Batch “spawn missing pairs for CBSE” / “for schools with ≥2 real parents”
- Spawn API accepts `target: curriculum | school_class` and school+curriculum+grade recipes

### Phase 4 — Safety & hygiene

- [x] Audit log table `admin_seed_actions`
- [ ] Rate-limit spawn/post
- [ ] Script to deactivate all internal in a circle once real parent message volume > threshold

### Gap check (ops)

On Circles admin → **Check gaps** (after login):

1. Lists circles with real parents but &lt; 2 active internal asker/responder members
2. Suggests spawn recipes that cover the most gaps in one go (school + board/grade + PIN)
3. One-click **Spawn asker + responder** from a suggestion
4. Re-run anytime to compare after spawning

Example: Gaudium IB MYP Grade 9 + PIN 502032 can cover school_class + class + curriculum + locality gaps together, instead of separate PIN/curriculum-only accounts.

---

## Ops playbook (day-to-day)

1. Open **Admin → Circles → School**  
2. Pick a thin school (e.g. Abhaya with 3 parents)  
3. **Spawn pair**  
4. **Post as Asker** — one question in that school circle  
5. **Post as Responder** — one helpful reply  
6. When the circle is lively, **Deactivate** both (posts remain; no new login/posts)  
7. Tomorrow: same for **Curriculum / CBSE** if you want board-wide warm-start  

---

## Open decisions (confirm before build)

1. Exact school account display names / anonymous handles.
2. Whether inactive internal accounts remain included in admin counts by default.
3. Include review accounts in “Hide internal”? Recommendation: **yes**.
4. First target scope: school only, then curriculum, then school + class.

---

## Out of scope (for now)

- Fully autonomous AI agents chatting without admin  
- Impersonating **real** (non-internal) parents  
- Public-facing “Vaara staff” labels in the mobile app  

---

## Related code today

- Circles admin UI: `apps/web/public/internal/admin/circles.html`
- Circles admin API: `apps/api/src/routes/internal.ts` (`/admin/circles`)
- Membership: `apps/api/src/services/circle-sync.ts`
- Posting: `apps/api/src/routes/chat.ts` + `createThread` in chat services
- Existing review accounts: `playstore.review@vaara.ai`, `apple.review@vaara.ai`
