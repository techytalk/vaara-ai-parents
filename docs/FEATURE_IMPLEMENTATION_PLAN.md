# Vaara Parents — Feature Implementation Plan

Step-by-step technical plan for the features described in [Business Functionality](./BUSINESS_FUNCTIONALITY.md).

Every section maps to a numbered feature in that document. Read the behaviour there first; this document only covers *how*.

---

## 1. Ground rules

These apply to every feature below. They exist because breaking them creates rework or privacy bugs.

### 1.1 Reuse the existing primitives

| Need | Use this | Do not build |
|------|----------|--------------|
| A post appearing in several places | `circle_posts` + `circle_post_targets` (already supports up to 5 targets) | A second posts table per feature |
| Who may read a post | `circle_members` membership check | Per-feature visibility rules |
| Author display name | `buildAuthorView()` in `apps/api/src/lib/author.ts` | Denormalised author strings on rows |
| Automatic membership | `syncCircleMembership()` in `apps/api/src/services/circle-sync.ts` | Manual join or invite flows |
| Alerts | `createNotification()` in `apps/api/src/services/notifications.ts` | Direct `sendExpoPush()` calls from routes |
| Search | Postgres `tsvector`, following the `activities` pattern in `002_activity_search.sql` | An external search service |

**Never denormalise the anonymous author label onto a row.** It is derived per circle at read time by `buildAuthorView()`. A copied label goes stale when a parent changes a child's grade, and a stale label in the wrong circle is a privacy incident.

### 1.2 Migration conventions

Migrations are registered in the `MIGRATIONS` array in `packages/db/src/migrate.ts` and each file is wrapped in a single `BEGIN` / `COMMIT` by the runner.

**Critical constraint:** PostgreSQL allows `ALTER TYPE ... ADD VALUE` inside a transaction, but the new value **cannot be used in the same transaction**. Any migration that both adds an enum value and inserts a row using it will fail with `unsafe use of new value of enum type`.

Therefore **all enum additions go into one dedicated migration (`007`) that does nothing else.** Every later migration may then use those values freely.

Numbering continues from the existing `006_post_media`.

### 1.3 Privacy invariants

These must hold after every change:

1. A parent's `display_name`, `phone` and `email` are never returned by a circle, topic, listing or member endpoint.
2. Child `nickname` is never returned to anyone other than the owning parent.
3. A topic feed, saved list or search result never widens visibility — it filters posts the reader can already see.
4. Identity disclosure is per conversation, mutual, and logged. It never changes what the feed shows.

### 1.4 Definition of done for each feature

- Migration written, registered in `migrate.ts`, and applied to a Neon dev branch
- API routes added with `authMiddleware` and membership or ownership checks
- Types added to `packages/shared/types.ts` where shared, and to `apps/mobile/src/lib/api.ts`
- Mobile screens added under `apps/mobile/app/`
- Notifications routed through `createNotification()` with a preference key
- Acceptance criteria in the feature section verified manually on a device

---

## 2. Sequence

Build order follows section 8 of the business document. Two hard dependencies:

```
Phase A  ──►  Phase B  ──►  Phase C  ──►  Phase D
identity      trust +        content +     high-trust
+ engagement  marketplace    discovery     coordination

A: school+class circle, polls, provider reviews, notification consolidation
B: graduated disclosure, marketplace, saved posts
C: school reviews, topics, school calendar
D: local recommendations, expert sessions, playdates, carpool
```

| Phase | Features | Migrations |
|-------|----------|-----------|
| **A** | 3.1 enum additions, 3.2 school+class circle, 3.3 polls, 3.4 provider reviews, 3.5 notification consolidation | 007, 008, 009 |
| **B** | 4.1 graduated disclosure, 4.2 marketplace, 4.3 saved posts | 010, 011, 012 |
| **C** | 5.1 school reviews & fees, 5.2 topics, 5.3 school calendar | 013, 014, 015 |
| **D** | 6.1 local recommendations, 6.2 expert sessions, 6.3 playdates, 6.4 carpool | 016, 017, 018, 019 |

**Disclosure (4.1) must ship before marketplace (4.2), playdates (6.3) and carpool (6.4).** Those features dead-end without it.

**Notification consolidation (3.5) must ship before marketplace (4.2).** Marketplace is the first feature that adds a new fan-out source, and every Phase C and D feature adds another. Layering them onto the current per-circle loop will drive parents to disable push, which is not recoverable.

---

# Phase A — Identity and engagement

---

## 3.1 Enum additions

**Migration `007_enum_additions.sql`** — this file adds enum values and nothing else, per the constraint in 1.2.

```sql
-- Enum additions only. No inserts or table changes in this migration:
-- a new enum value cannot be used in the transaction that adds it.

ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'school_class';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'topic_digest';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_interest';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'disclosure_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'disclosure_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'carpool_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'expert_session';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'school_event';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'playdate_interest';
```

Register in `packages/db/src/migrate.ts`:

```ts
{ version: "007_enum_additions", file: "007_enum_additions.sql" },
```

`circle_reply` and `activity_nearby` already exist in the enum from `001_initial.sql`.

---

## 3.2 School + Class circle

Business reference: **4.1**

No new tables. This is a change to circle derivation, which means existing parents gain the circle automatically the next time their profile syncs.

### Service change — `apps/api/src/services/circle-sync.ts`

Add `"school_class"` to the `DesiredCircle` union, then inside the existing `for (const child of childrenResult.rows)` loop, after the school circle block:

```ts
// School + class circle — only when the school is actually known.
// Placeholder schools must not produce a circle.
if (
  child.school_normalized_key &&
  child.school_normalized_key !== PLACEHOLDER_SCHOOL_KEY
) {
  const schoolClassKey =
    `SCHOOL_CLASS_${child.school_normalized_key}` +
    `_${child.curriculum_code}_${child.grade_code}`;

  if (!seenKeys.has(schoolClassKey)) {
    seenKeys.add(schoolClassKey);
    desired.push({
      circleType: "school_class",
      key: schoolClassKey,
      displayName:
        `${formatSchoolLabel(child.school_name, child.school_branch, child.school_city)}` +
        ` · ${child.curriculum_name} · ${child.grade_label}`,
      metadata: {
        school_id: child.school_id,
        normalized_key: child.school_normalized_key,
        curriculum_id: child.curriculum_id,
        grade_id: child.grade_id,
        code: child.curriculum_code,
        grade_code: child.grade_code,
      },
    });
  }
}
```

The existing delete-then-insert reconciliation at the end of `syncCircleMembership()` handles grade progression with no extra work: when a child moves to Grade 7, the Grade 6 key is no longer in `desired`, so that membership row is removed and the new one inserted.

### Author context — `apps/api/src/lib/author.ts`

`buildAuthorView()` branches on `circle.circle_type`. Add a `school_class` branch that behaves like the existing `class` branch — pick the child matching this circle's curriculum **and** grade, and label with curriculum and grade only.

Do not include the school name in the label. Every member of the circle is already at that school, so repeating it adds no information and lengthens the row.

### Mobile

**`apps/mobile/src/constants/circles.ts`** — add the label:

```ts
export const CIRCLE_TYPE_LABELS: Record<Circle["circleType"], string> = {
  curriculum: "Curriculum",
  locality: "Pincode / Area",
  class: "Class",
  school: "School",
  school_class: "School class",
  community: "Community",
};
```

**`apps/mobile/src/lib/api.ts`** — add `"school_class"` to the `circleType` union on the `Circle` type.

**`apps/mobile/app/(app)/index.tsx`** — add a filtered list and a section. Place it **above** the generic class section, because it is the higher-intent circle:

```ts
const schoolClassCircles = circles.filter((c) => c.circleType === "school_class");
```

```tsx
<CircleSection
  title="My child's class at school"
  circles={schoolClassCircles}
  onPressCircle={openCircle}
/>
```

### Backfill

Existing parents only re-sync when they change a child or their location. Run a one-off script over parents who have a non-placeholder school:

```
for each parent with children.school_id not placeholder:
  syncCircleMembership(client, parent.id)
```

Put this in `packages/db/src/` as a standalone script rather than a migration, so it can be re-run safely.

### Acceptance criteria

- A parent with school, curriculum and grade set sees a `school_class` circle without any action
- Two parents at the same school, same curriculum, same grade share one circle
- Same school but different grade → different circles
- Same grade but different school → different circles
- Changing the child's grade removes the old membership and adds the new one
- A child with the placeholder school produces **no** `school_class` circle
- Author labels show curriculum and grade, never the school name

---

## 3.3 Polls in posts

Business reference: **4.3**

Polls attach to an existing `circle_posts` row, so they inherit multi-circle targeting and visibility for free.

### Migration `008_post_polls.sql`

```sql
CREATE TABLE post_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES circle_posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  results_hidden_until_vote boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_poll_options_poll ON poll_options(poll_id, sort_order);

-- One vote per parent per poll. Changing a vote updates this row,
-- so a count is always one-per-parent.
CREATE TABLE poll_votes (
  poll_id uuid NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX idx_poll_votes_option ON poll_votes(option_id);
```

`PRIMARY KEY (poll_id, user_id)` is what enforces one vote per parent. A vote change is an upsert on that key, never an insert.

### API — extend `apps/api/src/routes/circles.ts`

**Creating a poll** rides on the existing `POST /:circleId/posts` handler. Accept an optional `poll` object in the body:

```ts
poll?: {
  question: string;
  options: string[];        // 2..6
  hideResultsUntilVote?: boolean;
  closesAt?: string;
}
```

Validate inside the existing transaction, before `COMMIT`:

| Check | Limit |
|-------|-------|
| Options count | 2 to 6 |
| Option label length | 1 to 80 characters after trim |
| Duplicate labels | Rejected |
| Question length | 1 to 200 characters |
| Active polls per parent per day | 3 |

Insert `post_polls` then `poll_options` with `sort_order` from array index.

**New endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/circles/:circleId/posts/:postId/vote` | Cast or change a vote. Body `{ optionId }` |
| `DELETE` | `/v1/circles/:circleId/posts/:postId/vote` | Withdraw a vote |

Both must verify circle membership with the existing `assertCircleMember()` before touching the poll.

Vote upsert:

```sql
INSERT INTO poll_votes (poll_id, user_id, option_id)
VALUES ($1, $2, $3)
ON CONFLICT (poll_id, user_id)
DO UPDATE SET option_id = EXCLUDED.option_id, updated_at = now()
```

Reject the vote if `closes_at` has passed.

### Poll payload on feed reads

Extend the existing `loadPostMedia()` pattern with a `loadPostPolls()` helper that batch-loads polls for a page of post ids, so the feed stays at a fixed number of queries.

Returned shape:

```ts
type PollView = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; voteCount: number }>;
  myOptionId: string | null;
  totalVotes: number;
  resultsVisible: boolean;   // false when hidden and viewer has not voted
  closesAt: string | null;
};
```

**Two privacy rules in the read path:**

1. `poll_votes` rows are never returned. Only aggregate counts per option, plus the viewer's own `myOptionId`.
2. When the circle has fewer than **5** members, set `resultsVisible: false` and return zeroed counts until at least 5 votes exist. In a circle of three, a count identifies the voter.

### Mobile

| File | Change |
|------|--------|
| `app/circles/[circleId]/new-post.tsx` | Optional poll composer — question, 2–6 option rows, hide-results toggle |
| `src/components/circles/ui.tsx` | New `PollCard` — options as tappable rows, horizontal bars and counts after voting |
| `app/circles/[circleId]/index.tsx` | Render `PollCard` inside `PostCard` when `post.poll` exists |
| `app/circles/[circleId]/posts/[postId].tsx` | Same rendering on the thread screen |
| `src/lib/api.ts` | `votePoll()`, `withdrawVote()`, `PollView` type, `poll` field on `CirclePost` |

Vote optimistically — update the local count on tap, then reconcile with the response. A poll that feels slow defeats the point.

### Notifications

A poll produces **no** additional notification. The parent post already notified the circle. Vote counts changing must never notify anyone.

### Acceptance criteria

- A post can be created with 2–6 options; 1 or 7 is rejected
- One parent's repeated votes never increase the total beyond one
- Changing a vote moves the count between options
- With hide-results enabled, counts are invisible until the viewer votes
- In a circle of 3 members, results stay hidden
- Voting after `closes_at` is rejected
- No endpoint reveals which parent voted for which option

---

## 3.4 Provider reviews and verification

Business reference: **4.2**

`providers.verified` already exists as a boolean. This adds the review system and a real verification record behind that flag.

### Migration `009_reviews_and_notifications.sql`

This migration carries the remaining Phase A schema: review tables here, plus the two notification tables defined in 3.5 (`notification_outbox` and `notification_mutes`).

```sql
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected', 'expired');

CREATE TABLE provider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  status verification_status NOT NULL DEFAULT 'pending',
  document_refs jsonb NOT NULL DEFAULT '[]',
  reviewed_by text,
  reviewer_note text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_verifications_provider
  ON provider_verifications(provider_id, created_at DESC);

CREATE TABLE provider_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  -- true when the author saved the activity or set a reminder before reviewing
  engagement_verified boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- one review per parent per provider
  UNIQUE (provider_id, author_id)
);

CREATE INDEX idx_provider_reviews_provider
  ON provider_reviews(provider_id, created_at DESC) WHERE hidden = false;

CREATE TABLE provider_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES provider_reviews(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE providers
  ADD COLUMN fee_min numeric(10,2),
  ADD COLUMN fee_max numeric(10,2),
  ADD COLUMN rating_avg numeric(3,2),
  ADD COLUMN rating_count int NOT NULL DEFAULT 0,
  ADD COLUMN last_confirmed_at timestamptz;

ALTER TABLE reports
  ADD COLUMN target_review_id uuid REFERENCES provider_reviews(id);
```

`UNIQUE (provider_id, author_id)` prevents review stuffing by one parent. `provider_review_replies.review_id UNIQUE` enforces one public reply per review.

`rating_avg` and `rating_count` are denormalised counters — recompute inside the same transaction as any review insert, update, or hide.

### API — new file `apps/api/src/routes/reviews.ts`

Mount as `app.route("/v1/providers", createProviderReviewRoutes())` in `apps/api/src/index.ts`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/v1/providers/:providerId/reviews` | parent | Paginated reviews with anonymous authors |
| `POST` | `/v1/providers/:providerId/reviews` | parent | Create or update own review |
| `DELETE` | `/v1/providers/:providerId/reviews/mine` | parent | Remove own review |
| `POST` | `/v1/provider/reviews/:reviewId/reply` | provider | One public reply, own reviews only |
| `POST` | `/v1/provider/verification` | provider | Submit documents, sets status `pending` |
| `GET` | `/v1/provider/verification` | provider | Own verification status |

**Review author display.** Reviews are written by parents and must stay anonymous. Reuse `anonymous_handle` plus a coarse context label (`CBSE · G6`) derived at read time. Do **not** call `buildAuthorView()` here — it takes a circle, and a review has no circle. Add a small `buildReviewAuthorView()` in `apps/api/src/lib/author.ts` that returns handle plus curriculum and grade only.

**Engagement verification.** Set `engagement_verified = true` when the author has a `reminders` row or a saved activity for that provider. This is the honest, checkable signal — it proves interest, not attendance, and the UI must label it as such.

**Rating display rule.** Return `rating_avg` as `null` until `rating_count >= 3`. A single review must not present itself as a rating.

### Activity discovery changes — `apps/api/src/routes/activities.ts`

Extend the existing pin-code and curriculum filtering with:

- `verifiedOnly` query flag
- Sort options: `rating`, `recent`, `fee_low`
- Include `provider.verified`, `rating_avg`, `rating_count`, `fee_min`, `fee_max` in list responses
- Exclude providers whose `last_confirmed_at` is older than 180 days from default discovery, while keeping them reachable by direct link

### Mobile

| File | Change |
|------|--------|
| `app/(app)/activities/index.tsx` | Verified filter, sort control, rating and fee range on cards |
| `app/(app)/activities/[id].tsx` | Reviews list, rating summary, verified badge, write-review entry |
| `app/(app)/activities/review.tsx` | New — star input plus optional text |
| `app/(provider)/reviews.tsx` | New — provider sees own reviews and can reply once |
| `app/(provider)/verification.tsx` | New — submit documents, see status |
| `src/lib/api.ts` | Review and verification methods, `ProviderReview` type |

### Notifications

| Event | Recipient | Type | Immediate? |
|-------|-----------|------|-----------|
| New review received | Provider | `provider_update` | Yes |
| Provider replied to your review | Review author | `provider_update` | Yes |
| Verification approved or rejected | Provider | `provider_update` | Yes |

### Acceptance criteria

- A parent can post exactly one review per provider; a second submission updates the first
- `rating_avg` is `null` and hidden in the UI until three reviews exist
- Review authors appear as anonymous handles with curriculum and grade only — never a real name
- A provider can reply once per review and cannot edit or delete a parent's review
- `verified` is only ever set through a `provider_verifications` row with a recorded reviewer and date
- Reported reviews can be hidden, and hiding recomputes the average
- Providers not reconfirmed for 180 days drop out of default discovery

---

## 3.5 Notification consolidation

Business reference: **section 7**

A refactor, not a feature. It must land before Phase C.

### Problems in the current implementation

Reading `apps/api/src/services/notifications.ts` and the post handler in `circles.ts`:

1. **Duplicate notifications on multi-circle posts.** `POST /:circleId/posts` loops `targetResult.rows` and calls `notifyCirclePost()` once per target circle. A parent in three of those circles receives three notifications for one post.
2. **Crude throttle.** `notifyCirclePost()` suppresses a circle post notification if any exists for that circle within the last hour. That both over-suppresses genuinely important posts and under-solves the duplicate problem.
3. **Synchronous fan-out inside the HTTP request.** Members are looped, and `sendExpoPush()` is awaited per member, inside the same request and transaction as the post insert. A large circle makes posting slow, and a push failure can affect the write path.
4. **`circle_reply` is never sent.** The enum value exists in `001_initial.sql` and the business rule is documented in `ARCHITECTURE.md`, but the reply handler in `circles.ts` does not call any notify function.

### Changes

**a. One notification per event, not per target circle.**

Replace the per-target loop with a single call that takes all target circles:

```ts
await notifyCirclePostMulti(client, {
  targets: targetResult.rows,      // all circles the post landed in
  postId: rows[0].id,
  authorId: userId,
  postPreview: text || "Shared a photo or video",
});
```

Inside, resolve the recipient set once with a union query, so each parent appears exactly once:

```sql
SELECT DISTINCT u.id, u.push_token, u.notification_prefs
FROM circle_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.circle_id = ANY($1::uuid[])
  AND cm.user_id <> $2
```

Title the notification from the parent's **most specific** matching circle, using the precedence `school_class > class > school > community > locality > curriculum`. If Meera is in both the Gaudium Grade 6 circle and the 560102 circle, she should see the Grade 6 name, because that is the more relevant context.

**b. Batch the writes.** Insert notification rows with a single multi-row `INSERT ... SELECT` over the recipient set instead of one statement per member.

**c. Move push delivery out of the request.** Insert an outbox row in the same transaction as the post, and let a worker deliver:

```sql
CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_outbox_pending
  ON notification_outbox(created_at) WHERE delivered_at IS NULL;
```

The existing reminder cron in `apps/api/src/index.ts` and `POST /internal/cron/reminders` already establish this pattern — extend the same worker to drain the outbox. Expo push also accepts batched sends, which cuts request volume substantially.

**d. Digest versus immediate.** Add a `delivery` field to `createNotification()`:

| Delivery | Behaviour | Used by |
|----------|-----------|---------|
| `immediate` | Outbox row created at once | DM, reply to your post, disclosure request, carpool change, reminder, expert session start |
| `digest` | In-app row only; a scheduled job aggregates into one push | Circle posts, topic posts, new listings, calendar additions |

**e. Wire `circle_reply`.** Add `notifyCircleReply()` and call it from the reply handler for the post author, skipping self-replies, with pref key `circle_replies`.

**f. Extend preferences.** `apps/api/src/lib/notification-prefs.ts` currently defines a flat set. Extend `DEFAULT_NOTIFICATION_PREFS` with `circle_replies`, `topics`, `listings`, `disclosures`, `carpool`, `school_events`, `expert_sessions`, and add per-circle and per-topic mutes:

```sql
CREATE TABLE notification_mutes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,          -- 'circle' | 'topic' | 'listing'
  scope_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, scope_id)
);
```

Both `notification_outbox` and `notification_mutes` belong to migration `009_reviews_and_notifications.sql`, which carries all remaining Phase A schema.

### Acceptance criteria

- A post targeting three circles a parent belongs to produces exactly one notification and one push
- The notification title names the most specific circle for that recipient
- Posting to a 1,000-member circle returns in normal request time; delivery happens asynchronously
- A reply to a post notifies the post author, and never for a self-reply
- Muting one circle stops its notifications while others continue
- Push failures are retried by the worker and never fail the originating write
- Nothing non-urgent is delivered during quiet hours

---

# Phase B — Trust and marketplace

---

## 4.1 Graduated identity disclosure

Business reference: **section 6**

The most sensitive change in the plan. Ships before marketplace, playdates and carpool because all three depend on it.

### Model

Disclosure is a property of a **conversation**, not of a user. Each participant independently offers a level; the **effective level is the minimum of the two**, so nothing is revealed until both sides agree.

```
Meera offers level 2  ┐
                      ├─►  effective level = min(2, 0) = 0   nothing revealed
Anitha offers level 0 ┘

Meera offers level 2  ┐
                      ├─►  effective level = min(2, 2) = 2   first name + flat
Anitha offers level 2 ┘
```

| Level | Name | Fields exposed |
|-------|------|----------------|
| 0 | Anonymous | `anonymous_handle`, curriculum, grade |
| 1 | Anonymous chat | same as 0 |
| 2 | Introduced | first name, block or flat |
| 3 | Full contact | name, flat, phone, vehicle |

Level 1 exists as a distinct state so the UI can show that a chat is open without implying any identity change.

### Migration `010_disclosures.sql`

```sql
-- Level offered by each participant in a conversation. The effective
-- disclosure level is the MINIMUM of both participants' offers, so
-- disclosure is always mutual.
CREATE TABLE conversation_disclosures (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_level int NOT NULL DEFAULT 0 CHECK (offered_level BETWEEN 0 AND 3),
  purpose text,                 -- 'marketplace' | 'playdate' | 'carpool' | 'other'
  offered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Append-only audit trail. Never updated, never deleted.
CREATE TABLE disclosure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_level int NOT NULL,
  to_level int NOT NULL,
  purpose text,
  effective_level_after int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disclosure_events_conv
  ON disclosure_events(conversation_id, created_at);

-- Contact details used only at disclosure levels 2 and 3.
-- Separate from users so no circle or feed query can reach them by accident.
CREATE TABLE user_contact_details (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name text,
  block_or_flat text,
  contact_phone text,
  vehicle_description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports
  ADD COLUMN target_disclosure_conversation_id uuid REFERENCES conversations(id);
```

**Why a separate `user_contact_details` table.** Keeping `first_name`, `block_or_flat`, `contact_phone` out of `users` means no existing circle, member-list or feed query can leak them through a `SELECT *` or a careless join. Reaching this data requires deliberately joining a table whose name states its purpose. The privacy boundary is structural, not a matter of remembering to exclude columns.

### Service — new file `apps/api/src/services/disclosure.ts`

```ts
export type DisclosureLevel = 0 | 1 | 2 | 3;

/** Effective level is the minimum offer across both participants. */
export async function getEffectiveLevel(
  client: PoolClient,
  conversationId: string
): Promise<DisclosureLevel>;

/**
 * Raise the caller's offered level. Never lowers an existing offer.
 * Writes a disclosure_events row and notifies the peer.
 */
export async function offerDisclosure(
  client: PoolClient,
  params: {
    conversationId: string;
    userId: string;
    level: DisclosureLevel;
    purpose: string;
  }
): Promise<{ effectiveLevel: DisclosureLevel; peerOffered: DisclosureLevel }>;

/**
 * Returns the peer view for a conversation, containing only the fields
 * permitted at the current effective level.
 */
export async function buildPeerView(
  client: PoolClient,
  params: { conversationId: string; viewerId: string }
): Promise<PeerView>;
```

`buildPeerView()` is the single gate for peer identity. Every conversation, listing-chat and carpool response must obtain peer details through it and nowhere else.

```ts
type PeerView = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;              // "CBSE · G6"
  disclosureLevel: DisclosureLevel;
  firstName?: string;                // level >= 2, from user_contact_details
  blockOrFlat?: string;              // level >= 2, from user_contact_details
  fullName?: string;                 // level === 3, from users.display_name
  contactPhone?: string;             // level === 3
  vehicleDescription?: string;       // level === 3
};
```

Implementation rules:

1. Read the effective level first, then select **only** the columns that level permits. Do not fetch everything and filter in JavaScript — an accidental spread later would leak it.
2. Level 3 requires an explicit `purpose = 'carpool'` on both offers. No other flow may reach level 3.
3. Offers only ever increase. A request to lower a level is rejected; the correct action is block or report.
4. Child fields are never included at any level.
5. `users.display_name` is documented as never exposed in circles, and that stays true — level 3 is a per-conversation disclosure, not a circle. This is the **only** read path in the product permitted to return it, and only at level 3 with `purpose = 'carpool'`.

### API — extend `apps/api/src/routes/circles.ts` conversation routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/conversations/:id/disclosure` | Current effective level, own offer, peer offer |
| `POST` | `/v1/conversations/:id/disclosure` | Offer a level. Body `{ level, purpose }` |

Existing endpoints that must switch to `buildPeerView()`:

| Endpoint | Current behaviour | Change |
|----------|------------------|--------|
| `GET /v1/conversations` | Returns `peer.anonymousHandle` from a direct join | Use `buildPeerView()` per conversation |
| `GET /v1/conversations/:id/messages` | Derives `peerId` and handle inline | Use `buildPeerView()` |
| `POST /v1/conversations/:id/messages` | Returns sender handle | Unchanged — sender is self |

### Profile — extend `apps/api/src/routes/me.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/me/contact-details` | Own contact details |
| `PUT` | `/v1/me/contact-details` | Set first name, flat, phone, vehicle |

A parent is prompted for these **at the point of disclosure**, not during onboarding. Asking for a flat number during signup implies the app will expose it, which is exactly the wrong first impression.

### Mobile

| File | Change |
|------|--------|
| `app/(app)/messages/[conversationId].tsx` | Peer header reflects disclosure level; disclosure request and accept banners |
| `src/components/DisclosurePrompt.tsx` | New — states the exact fields being shared and requires explicit confirmation |
| `app/(app)/messages/index.tsx` | Inbox shows first name once level 2 is effective, handle otherwise |
| `app/(app)/profile.tsx` | Manage contact details, view disclosure history |
| `src/lib/api.ts` | Disclosure methods, `PeerView` type, contact-details methods |

**Prompt copy must be specific.** Never "share your details". Always the exact list:

> **Share your identity with this parent?**
> They will see: **first name**, **flat number**
> They will not see: phone, email, your child's name
> This applies only to this conversation and cannot be undone.

Level 3 gets a distinct full-screen confirmation, not a banner:

> **Carpooling requires full identity.**
> Anonymous carpooling is not permitted for child safety.
> You will share: name, flat number, phone, vehicle details.
> This cannot be undone for this arrangement.

### Notifications

| Event | Recipient | Type |
|-------|-----------|------|
| Peer offered a level above yours | Peer | `disclosure_request` |
| Both sides reached a level | Both | `disclosure_accepted` |

Both are `immediate` — a pending disclosure blocks a real-world arrangement.

### Acceptance criteria

- A one-sided offer reveals nothing; the peer still sees only the handle
- When both offer level 2, both see first name and flat, and neither sees a phone number
- Level 3 is reachable only with `purpose = 'carpool'` on both sides
- Disclosure in one conversation has **no** effect on any other conversation
- Circle feeds, member lists and topic feeds still show only anonymous handles for a parent who has disclosed elsewhere
- Every level change writes a `disclosure_events` row with both levels and the resulting effective level
- Attempting to lower a level is rejected
- No response at any level contains a child's nickname
- Blocking a peer stops the conversation without erasing the disclosure audit trail

---

## 4.2 Community marketplace

Business reference: **4.4**

Depends on 4.1.

### Migration `011_marketplace.sql`

```sql
CREATE TYPE listing_kind AS ENUM ('for_sale', 'free', 'wanted');
CREATE TYPE listing_status AS ENUM ('active', 'reserved', 'completed', 'expired', 'removed');

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind listing_kind NOT NULL,
  status listing_status NOT NULL DEFAULT 'active',
  category text NOT NULL,
  title text NOT NULL,
  description text,
  price_amount numeric(10,2),
  price_currency text DEFAULT 'INR',
  -- scope copied at creation so a later address change does not move the listing
  community_key text,
  pin_code text NOT NULL,
  school_id uuid REFERENCES schools(id),
  grade_id uuid REFERENCES curriculum_grades(id),
  search_vector tsvector,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'for_sale' OR price_amount IS NOT NULL)
);

CREATE INDEX idx_listings_community ON listings(community_key, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_pin ON listings(pin_code, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_school_grade ON listings(school_id, grade_id)
  WHERE status = 'active';
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);
CREATE INDEX idx_listings_expiry ON listings(expires_at) WHERE status = 'active';

CREATE TABLE listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  width int,
  height int,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_listing_media_listing ON listing_media(listing_id, sort_order);

CREATE TABLE listing_interests (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

ALTER TABLE reports ADD COLUMN target_listing_id uuid REFERENCES listings(id);
```

Add a `search_vector` trigger mirroring `002_activity_search.sql` over `title`, `description` and `category`.

**`community_key` and `pin_code` are copied at creation, not joined from `user_locations`.** If a parent moves, their old listings must stay attached to where they were posted.

### API — new file `apps/api/src/routes/listings.ts`

Mount as `app.route("/v1/listings", createListingRoutes())`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/listings` | Discovery — `scope=community\|pin`, `category`, `kind`, `q`, cursor |
| `POST` | `/v1/listings` | Create; scope derived from the caller's `user_locations` |
| `GET` | `/v1/listings/:id` | Detail with media and seller peer view |
| `PATCH` | `/v1/listings/:id` | Owner only — edit or change status |
| `DELETE` | `/v1/listings/:id` | Owner only — sets `removed` |
| `POST` | `/v1/listings/:id/interest` | Opens or returns a conversation with the seller |

Media reuses the existing presigned-upload flow in `apps/api/src/routes/media.ts` and `apps/api/src/lib/media-storage.ts`. Extend `verifyUploadedMedia()` for a `listing-media/` prefix; do not build a second upload path.

**Interest flow.** `POST /:id/interest` creates or resumes a conversation using the same logic as `POST /v1/conversations`, with one difference: **a shared circle is not required.** Sharing a community or pin code with the listing is sufficient basis. Record `conversation_id` on the `listing_interests` row so moderation can link a dispute to the listing.

**Limits:**

| Rule | Limit |
|------|-------|
| Active listings per parent | 10 |
| New listings per parent per week | 15 |
| Media per listing | 5 |
| Default expiry | 30 days |
| Prohibited categories | Blocked at creation with an explicit message |

### Expiry job

Extend the existing reminder worker (`processPendingReminders()` in `apps/api/src/services/notifications.ts`, driven by `POST /internal/cron/reminders`):

```
listings where status = 'active' and expires_at <= now()
  → status = 'expired'
  → notify seller once: "Still available? Repost in one tap."
```

### Mobile

| File | Change |
|------|--------|
| `app/(app)/market/index.tsx` | New tab — community and pin-code toggle, category filter, search |
| `app/(app)/market/[id].tsx` | New — detail, media gallery, "I'm interested" |
| `app/(app)/market/new.tsx` | New — create listing with photos |
| `app/(app)/market/mine.tsx` | New — own listings, mark completed, repost |
| `app/(app)/_layout.tsx` | Add the Market tab |
| `src/components/circles/ui.tsx` | Reuse `PostMediaGallery` for listing media |

Tab bar is already at five items (Home, Activities, Messages, Alerts, Account). Adding Market makes six, which is too many. **Move Alerts into the Home header as a bell icon with an unread badge** and give the freed slot to Market.

### Notifications

| Event | Recipient | Type | Delivery |
|-------|-----------|------|----------|
| New listing in your community | Community members | `listing_interest` | `digest` |
| Someone is interested | Seller | `listing_interest` | `immediate` |
| Your listing expired | Seller | `listing_interest` | `immediate` |

### Acceptance criteria

- A listing is visible to the poster's community, then their pin code, and never city-wide
- School-item listings also surface in the matching school circle
- Free items are visually distinct from priced ones
- Interest opens an anonymous conversation, and handover requires level 2 disclosure
- Marking completed removes the listing from discovery immediately
- Active listings expire after 30 days with one seller prompt
- Exceeding the listing cap returns a clear error
- A parent moving house does not move their existing listings

---

## 4.3 Saved posts

Business reference: **5.2**

Smallest feature in the plan.

### Migration `012_post_saves.sql`

```sql
CREATE TABLE saved_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type text NOT NULL,      -- 'post' | 'activity' | 'listing'
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE INDEX idx_saved_items_user ON saved_items(user_id, created_at DESC);
```

Deliberately **not** three foreign keys to three tables. A polymorphic pair keeps one table and one endpoint set; the read path resolves each type and skips anything deleted or moderated.

### API — extend `apps/api/src/routes/me.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/me/saved` | Saved items grouped by type, newest first |
| `POST` | `/v1/me/saved` | Save. Body `{ itemType, itemId }` |
| `DELETE` | `/v1/me/saved/:itemType/:itemId` | Unsave |

**Re-check visibility on read.** A saved post from a circle the parent has since left must not be returned. Filter through `circle_post_targets` and `circle_members` on every read of the saved list — never trust that access at save time still holds.

Saves are private: no save counts anywhere, and no notification to the author.

### Mobile

| File | Change |
|------|--------|
| `src/components/circles/ui.tsx` | Bookmark toggle on `PostCard` and the thread header |
| `app/(app)/saved.tsx` | New — grouped saved list |
| `app/(app)/profile.tsx` | Link to Saved |
| `app/(app)/activities/[id].tsx`, `app/(app)/market/[id].tsx` | Save action |

### Acceptance criteria

- Saving is one tap and reflected immediately
- A saved post from a circle the parent has left is excluded from the list
- A deleted or moderated item shows a neutral placeholder, not an error
- No save counts are exposed and no author is notified
- Saved state survives app restart

---

# Phase C — Content and discovery

---

## 5.1 School reviews and fee transparency

Business reference: **4.5**

The one feature whose read path is available to parents who have **no circle yet**, which makes it the entry point for new users.

### Migration `013_school_reviews.sql`

```sql
CREATE TABLE school_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  -- true when the author has a child linked to this school
  attendance_verified boolean NOT NULL DEFAULT false,
  academic_year text,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, author_id)
);

CREATE INDEX idx_school_reviews_school
  ON school_reviews(school_id, created_at DESC) WHERE hidden = false;

-- Parent-reported fees. Always shown as a range with a reported-on date,
-- never as an authoritative figure.
CREATE TABLE school_fee_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES curriculum_grades(id),
  academic_year text NOT NULL,
  tuition_amount numeric(10,2) NOT NULL,
  transport_amount numeric(10,2),
  books_uniform_amount numeric(10,2),
  other_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, reporter_id, academic_year, grade_id)
);

CREATE INDEX idx_school_fee_reports_school
  ON school_fee_reports(school_id, academic_year);

-- Questions from prospective parents, answered by the school circle.
CREATE TABLE school_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  circle_post_id uuid REFERENCES circle_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schools
  ADD COLUMN board_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN grades_offered text,
  ADD COLUMN transport_available boolean,
  ADD COLUMN rating_avg numeric(3,2),
  ADD COLUMN rating_count int NOT NULL DEFAULT 0;

ALTER TABLE reports
  ADD COLUMN target_school_review_id uuid REFERENCES school_reviews(id);
```

### API — extend `apps/api/src/routes/schools.ts`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/v1/schools/:id/profile` | parent | Profile, rating, fee range, review count |
| `GET` | `/v1/schools/:id/reviews` | parent | Paginated anonymous reviews |
| `POST` | `/v1/schools/:id/reviews` | parent | Create or update own review |
| `GET` | `/v1/schools/:id/fees` | parent | Aggregated range plus year-on-year change |
| `POST` | `/v1/schools/:id/fees` | parent | Report own fees for a year and grade |
| `POST` | `/v1/schools/:id/questions` | parent | Ask current parents |
| `GET` | `/v1/schools/compare?ids=a,b,c` | parent | Side-by-side, max 3 |

**Fee aggregation rules.** Return a range, never a single number:

- Require at least 3 reports for an academic year before publishing a range
- Publish the 25th to 75th percentile of total cost, so one outlier cannot distort it
- Always include `reportedCount` and `latestReportedAt`
- Reports older than two academic years are excluded from the current range and kept for the history series

**Ask current parents.** `POST /v1/schools/:id/questions` creates a `circle_posts` row in that school's circle, authored by the asker, with the asker **not** a member. Implementation notes:

1. The post is created with a `school_question` marker in its metadata so the UI can present it distinctly.
2. The asker can read replies to that post only, via `school_questions.circle_post_id` — never the wider school feed.
3. The asker appears as their anonymous handle with no curriculum or grade context, since they have no child at the school yet.
4. Rate limit: 3 questions per parent per week across all schools.

This is the one deliberate exception to "posts are only readable by circle members", so it must be implemented as a narrow, explicit read path and not by relaxing `assertCircleMember()`.

### Mobile

| File | Change |
|------|--------|
| `app/(app)/schools/index.tsx` | New — search and browse by pin code or city |
| `app/(app)/schools/[id].tsx` | New — profile, fees, reviews, ask-parents |
| `app/(app)/schools/compare.tsx` | New — up to three side by side |
| `app/(app)/schools/review.tsx` | New — write a review |
| `src/components/onboarding/SchoolPicker.tsx` | Link through to the school profile |

### Acceptance criteria

- A fee range appears only with three or more reports for that year, with the count and date shown
- One outlier report does not shift the displayed range materially
- Reviews are anonymous and require a linked child at that school for the verified marker
- `rating_avg` is hidden below three reviews
- A prospective parent can ask a question and read only its replies, never the school feed
- Reported fee data older than two years is excluded from the current range but retained for history

---

## 5.2 Curated interest topics

Business reference: **5.1**

Topics are **labels on existing posts**. No new posts table, no membership, no per-topic feed storage.

### Migration `014_topics.sql`

```sql
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  sensitive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  follower_count int NOT NULL DEFAULT 0,
  post_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_topics_active ON topics(active, name);

-- Alternate spellings collapse onto one canonical topic.
CREATE TABLE topic_aliases (
  alias text PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE post_topics (
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, topic_id)
);

CREATE INDEX idx_post_topics_topic ON post_topics(topic_id, post_id);

CREATE TABLE topic_follows (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE topic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_name text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending',   -- pending | approved | merged | rejected
  merged_into_topic_id uuid REFERENCES topics(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Seed 40–60 topics in `packages/db/src/seed.ts` — screen time, exam stress, picky eating, sleep, tantrums, teen behaviour, learning differences, admissions, board choice, pregnancy, infant care, sibling rivalry, bullying, extracurriculars, transport safety, and similar.

### The visibility-safe topic feed

This is the only query in the feature that matters. A topic feed **must not** widen visibility — it filters posts the reader can already see.

```sql
SELECT DISTINCT p.id, p.body, p.tag, p.reply_count, p.created_at, p.author_id,
       u.anonymous_handle
FROM circle_posts p
JOIN post_topics pt        ON pt.post_id = p.id
JOIN circle_post_targets t ON t.post_id  = p.id
JOIN circle_members cm     ON cm.circle_id = t.circle_id
JOIN users u               ON u.id = p.author_id
WHERE pt.topic_id = $1
  AND cm.user_id  = $2            -- the reader; this is the visibility gate
  AND ($3::timestamptz IS NULL OR p.created_at < $3)
ORDER BY p.created_at DESC
LIMIT $4
```

The `JOIN circle_members cm ... AND cm.user_id = $2` clause is what makes this safe. Removing it would expose every circle's posts to everyone — treat it as a fixed part of the query and cover it with a test.

**Author label in a topic feed.** `buildAuthorView()` needs a circle. For a topic feed, pass the reader's **most specific shared circle** for that post, using the same precedence as notifications. Never fall back to an unscoped label.

### API — new file `apps/api/src/routes/topics.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/topics` | Active catalogue, grouped by category |
| `GET` | `/v1/topics/:slug/feed` | Visibility-filtered feed, cursor paginated |
| `POST` | `/v1/topics/:slug/follow` | Follow |
| `DELETE` | `/v1/topics/:slug/follow` | Unfollow |
| `GET` | `/v1/me/topics` | Followed topics |
| `POST` | `/v1/topics/requests` | Request a new topic |

Tagging extends the existing `POST /v1/circles/:circleId/posts` body with `topicSlugs?: string[]`, capped at **3** per post. Resolve each slug through `topics` and `topic_aliases`; reject unknown slugs rather than silently creating them.

### Mobile

| File | Change |
|------|--------|
| `app/circles/[circleId]/new-post.tsx` | Topic picker with search, max 3 |
| `app/(app)/topics/index.tsx` | New — catalogue and followed topics |
| `app/(app)/topics/[slug].tsx` | New — topic feed |
| `src/components/circles/ui.tsx` | Topic chips on `PostCard`, tappable |

### Notifications

Topic activity is **always** `digest`. A followed topic spanning many circles would otherwise produce constant pushes — the exact failure described in section 7 of the business document.

### Acceptance criteria

- A newly seeded topic immediately shows existing posts, because labels apply retroactively
- A parent never sees a post from a circle they do not belong to, through any topic
- Maximum 3 topics per post
- Unknown slugs are rejected; parents cannot create topics directly
- Aliases resolve to the canonical topic
- Topic notifications arrive only as a digest
- Author labels in topic feeds are derived from a circle the reader actually shares

---

## 5.3 School calendar

Business reference: **5.3**

### Migration `015_school_calendar.sql`

```sql
CREATE TYPE school_event_source AS ENUM ('official', 'parent_reported');

CREATE TABLE school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES curriculum_grades(id),   -- null = whole school
  title text NOT NULL,
  description text,
  event_type text NOT NULL,        -- exam | ptm | holiday | fee_due | event | deadline
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  source school_event_source NOT NULL DEFAULT 'parent_reported',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_count int NOT NULL DEFAULT 0,
  disputed_count int NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_events_school_start
  ON school_events(school_id, starts_at) WHERE hidden = false;

CREATE TABLE school_event_flags (
  event_id uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag text NOT NULL,              -- 'confirm' | 'dispute'
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
```

### API — new file `apps/api/src/routes/school-events.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/schools/:id/events` | Range query, filtered to the parent's child grades |
| `POST` | `/v1/schools/:id/events` | Parent-reported entry |
| `POST` | `/v1/school-events/:id/flag` | Confirm or dispute |
| `POST` | `/v1/school-events/:id/remind` | Create a `reminders` row for this event |

Reminders reuse the existing `reminders` table and worker. Add a nullable `school_event_id` column to `reminders` in this migration.

**Confidence rules:**

- `official` events display plainly
- `parent_reported` events are labelled **Unconfirmed** until `confirmed_count >= 3`
- An event with `disputed_count >= 2` shows a warning and is queued for review
- Reminders from unconfirmed events carry the unconfirmed label in the notification text

### Mobile

| File | Change |
|------|--------|
| `app/(app)/calendar.tsx` | New — upcoming list plus month view |
| `app/(app)/index.tsx` | "This week at school" strip on Home when events exist |
| `app/(app)/calendar/new.tsx` | New — report an event |

Surface the calendar only for schools with a populated set of events; a nearly empty calendar makes the whole app feel abandoned.

### Acceptance criteria

- A parent sees events for their child's school, filtered to relevant grades
- Unconfirmed events are visually distinct and confirm at three confirmations
- Two disputes flag an event for review
- Reminders fire through the existing worker
- The Home strip appears only when there are upcoming events

---

# Phase D — High-trust coordination

All four features depend on graduated disclosure (4.1) and on moderation being in active use.

---

## 6.1 Local recommendations

Business reference: **5.4**

### Migration `016_local_recommendations.sql`

```sql
CREATE TABLE local_practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,          -- pediatrician | dentist | therapist | optometrist | other
  clinic_name text,
  pin_code text NOT NULL,
  locality text,
  city text,
  normalized_key text UNIQUE NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recommendation_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_practitioners_pin_category
  ON local_practitioners(pin_code, category);
CREATE INDEX idx_practitioners_name_trgm
  ON local_practitioners USING GIN (name gin_trgm_ops);

CREATE TABLE practitioner_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES local_practitioners(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- logistics only: waiting time, manner, fee range, appointment reality
  note text,
  wait_time_band text,             -- under_15 | 15_30 | 30_60 | over_60
  fee_band text,                   -- under_500 | 500_1000 | 1000_2000 | over_2000
  good_with_young_children boolean,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, author_id)
);

ALTER TABLE reports
  ADD COLUMN target_recommendation_id uuid REFERENCES practitioner_recommendations(id);
```

`pg_trgm` is already enabled by `003_schools.sql`.

**There is no rating column, deliberately.** Star-rating a doctor invites medical judgement. Parents describe logistics and manner; they do not score clinical competence.

### Content guardrail — new file `apps/api/src/lib/content-guard.ts`

```ts
/**
 * Blocks medical self-help content before it is published.
 * Applied to practitioner recommendations and to posts in sensitive topics.
 */
export function detectMedicalAdvice(text: string): {
  blocked: boolean;
  reason?: string;
};
```

Rules: reject text matching symptom-plus-dosage patterns, medicine names against a maintained list, and phrasings like "should I give", "how much syrup", "is it normal that his fever". Return a clear message pointing the parent to a professional, and do not save the content.

This is deliberately conservative. False positives are recoverable; publishing medication advice between parents is not.

### API — new file `apps/api/src/routes/practitioners.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/practitioners` | By pin code and category, sorted by recommendation count |
| `POST` | `/v1/practitioners` | Add a practitioner, deduplicated on `normalized_key` |
| `GET` | `/v1/practitioners/:id` | Detail with anonymous recommendations |
| `POST` | `/v1/practitioners/:id/recommend` | Own recommendation, passed through the content guard |

For therapy and special-needs categories, **omit the author's curriculum and grade context entirely** — return the bare handle. In a small locality, "CBSE · G3" alongside a therapy recommendation can identify a child.

### Acceptance criteria

- Discovery works by pin code and category
- Symptom and medication text is blocked before saving, with a professional-referral message
- No rating field exists anywhere in the feature
- Therapy and special-needs recommendations carry no child context label
- A permanent disclaimer is visible on list and detail screens
- Practitioners cannot author or edit recommendations

---

## 6.2 Expert sessions

Business reference: **5.5**

### Migration `017_expert_sessions.sql`

```sql
CREATE TYPE expert_session_status AS ENUM ('announced', 'collecting', 'live', 'closed', 'cancelled');

CREATE TABLE experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  credentials text NOT NULL,
  bio text,
  photo_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  topic_id uuid REFERENCES topics(id),
  status expert_session_status NOT NULL DEFAULT 'announced',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expert_sessions_starts ON expert_sessions(starts_at);

CREATE TABLE session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES expert_sessions(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  upvote_count int NOT NULL DEFAULT 0,
  answer_body text,
  answered_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_questions_session
  ON session_questions(session_id, upvote_count DESC) WHERE hidden = false;

CREATE TABLE session_question_votes (
  question_id uuid NOT NULL REFERENCES session_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);
```

### API — new file `apps/api/src/routes/expert-sessions.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/expert-sessions` | Upcoming and archived |
| `GET` | `/v1/expert-sessions/:id` | Detail with questions ordered by upvotes |
| `POST` | `/v1/expert-sessions/:id/questions` | Submit anonymously |
| `POST` | `/v1/expert-sessions/questions/:qid/upvote` | Upvote, one per parent |
| `POST` | `/v1/expert-sessions/questions/:qid/answer` | Expert only |

**Askers are anonymous; experts are named.** That asymmetry is the feature. Return only `anonymous_handle` for askers, with no curriculum or grade context — a session on a sensitive subject plus a child context label is identifying.

Sessions become searchable content after closing, which is the main return on an expert's hour.

### Acceptance criteria

- A parent can submit a question anonymously with no context label attached
- Upvotes are one per parent and reorder the list
- Only the assigned expert can answer
- Closed sessions remain readable and searchable
- Expert credentials are verified before a session is announced

---

## 6.3 Playdates

Business reference: **5.6**

Highest safety bar. Depends on 4.1.

### Migration `018_playdates.sql`

```sql
-- Opt-in, per child, off by default.
CREATE TABLE playdate_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  age_band text NOT NULL,          -- '0_2' | '2_4' | '4_6' | '6_8' | '8_12' | '12_plus'
  scope text NOT NULL,             -- 'community' | 'pin'
  community_key text,
  pin_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id)
);

CREATE INDEX idx_playdate_optins_match
  ON playdate_optins(age_band, community_key, pin_code) WHERE active = true;
```

**`age_band` is stored, never a date of birth.** The matching query must be incapable of returning an exact age.

### API — new file `apps/api/src/routes/playdates.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/playdates/matches` | Count and anonymous handles of matching parents |
| `POST` | `/v1/playdates/optin` | Opt in a child with an age band and scope |
| `DELETE` | `/v1/playdates/optin/:childId` | Opt out |
| `POST` | `/v1/playdates/connect` | Open a conversation with a matched parent |

**The match response returns parent handles and an age band only.** Never `children.nickname`, never `child_id`, never an exact age, never a photo, never a school.

Eligibility for matching:

| Requirement | Reason |
|-------------|--------|
| Verified parent account with completed onboarding | Excludes drive-by accounts |
| Explicit opt-in per child | Never inferred from profile data |
| Level 2 disclosure before arranging a meeting | Enforced in the conversation, not by convention |
| Minimum matching pool before the feature is surfaced | An empty matcher invites probing |

### Acceptance criteria

- Matching is off until a parent explicitly opts in a child
- No response exposes a child's name, exact age, photo or school
- Arranging a meeting requires mutual level 2 disclosure
- Opting out removes the child from matching immediately
- Report and block are reachable from every playdate screen
- The feature is hidden where the matching pool is too small

---

## 6.4 Carpool

Business reference: **5.7**

Requires level 3 disclosure. Build last.

### Migration `019_carpool.sql`

```sql
CREATE TYPE carpool_status AS ENUM ('open', 'forming', 'active', 'paused', 'closed');
CREATE TYPE carpool_role AS ENUM ('driver', 'rider', 'either');

CREATE TABLE carpool_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  community_key text,
  pin_code text NOT NULL,
  role carpool_role NOT NULL,
  direction text NOT NULL,         -- 'to_school' | 'from_school' | 'both'
  days_of_week int[] NOT NULL,     -- 1 = Monday
  departure_time time NOT NULL,
  seats int,
  status carpool_status NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_carpool_offers_match
  ON carpool_offers(school_id, pin_code, departure_time)
  WHERE status IN ('open', 'forming');

CREATE TABLE carpool_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status carpool_status NOT NULL DEFAULT 'forming',
  departure_time time NOT NULL,
  days_of_week int[] NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE carpool_participants (
  arrangement_id uuid NOT NULL REFERENCES carpool_arrangements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role carpool_role NOT NULL,
  -- an arrangement cannot be confirmed until every participant is at level 3
  disclosure_confirmed_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (arrangement_id, user_id)
);
```

### Enforcement

The rule that must not be bypassable: an arrangement may only move to `active` when **every** participant has `disclosure_confirmed_at` set, backed by a level 3 offer with `purpose = 'carpool'`.

Enforce in the service layer **and** with a database check, because this one carries child-safety consequences:

```sql
-- Called before transitioning an arrangement to 'active'
CREATE OR REPLACE FUNCTION assert_carpool_fully_disclosed(arr_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM carpool_participants
    WHERE arrangement_id = arr_id
      AND left_at IS NULL
      AND disclosure_confirmed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'All carpool participants must complete level 3 disclosure';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### API — new file `apps/api/src/routes/carpool.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/carpool/matches` | Same school plus same locality, near the requested time |
| `POST` | `/v1/carpool/offers` | Declare direction, days, time, seats |
| `PATCH` | `/v1/carpool/offers/:id` | Update or pause |
| `POST` | `/v1/carpool/arrangements` | Create from matched offers |
| `POST` | `/v1/carpool/arrangements/:id/join` | Join, requires level 3 |
| `POST` | `/v1/carpool/arrangements/:id/leave` | Leave, notifies all participants |

Matching requires **both** the same `school_id` and the same `community_key` or `pin_code`. Never match on school alone — a carpool across the city is not a carpool.

### Positioning in the product

State plainly on every carpool screen: Vaara introduces parents and records the arrangement. It does not vet drivers, verify licences, insure rides, or track vehicles. Parents arrange between themselves.

### Acceptance criteria

- Matching requires the same school and the same locality
- An arrangement cannot reach `active` until every participant is at level 3
- The level 3 gate is a distinct full-screen confirmation, not a toggle
- Leaving notifies all remaining participants
- Vehicle and phone details are visible only to participants of the same arrangement
- No payment or fuel-sharing feature exists
- Report and block are reachable from every carpool screen

---

# 7. Migration registry

Final state of the `MIGRATIONS` array in `packages/db/src/migrate.ts`:

```ts
const MIGRATIONS = [
  { version: "001_initial", file: "001_initial.sql" },
  { version: "002_activity_search", file: "002_activity_search.sql" },
  { version: "003_schools", file: "003_schools.sql" },
  { version: "004_class_school_circles", file: "004_class_school_circles.sql" },
  { version: "005_multi_circle_posts", file: "005_multi_circle_posts.sql" },
  { version: "006_post_media", file: "006_post_media.sql" },
  // Phase A
  { version: "007_enum_additions", file: "007_enum_additions.sql" },
  { version: "008_post_polls", file: "008_post_polls.sql" },
  { version: "009_reviews_and_notifications", file: "009_reviews_and_notifications.sql" },
  // Phase B
  { version: "010_disclosures", file: "010_disclosures.sql" },
  { version: "011_marketplace", file: "011_marketplace.sql" },
  { version: "012_post_saves", file: "012_post_saves.sql" },
  // Phase C
  { version: "013_school_reviews", file: "013_school_reviews.sql" },
  { version: "014_topics", file: "014_topics.sql" },
  { version: "015_school_calendar", file: "015_school_calendar.sql" },
  // Phase D
  { version: "016_local_recommendations", file: "016_local_recommendations.sql" },
  { version: "017_expert_sessions", file: "017_expert_sessions.sql" },
  { version: "018_playdates", file: "018_playdates.sql" },
  { version: "019_carpool", file: "019_carpool.sql" },
];
```

Migrations are additive and forward-only. Test each one on a Neon dev branch before the primary — `neon branch create` gives a disposable copy with real data shape.

---

# 8. New files summary

## API — `apps/api/src/`

| Path | Status | Purpose |
|------|--------|---------|
| `routes/reviews.ts` | new | Provider reviews and verification |
| `routes/listings.ts` | new | Marketplace |
| `routes/topics.ts` | new | Topic catalogue and feeds |
| `routes/school-events.ts` | new | School calendar |
| `routes/practitioners.ts` | new | Local recommendations |
| `routes/expert-sessions.ts` | new | Expert Q&A |
| `routes/playdates.ts` | new | Playdate matching |
| `routes/carpool.ts` | new | Carpool |
| `services/disclosure.ts` | new | Graduated disclosure, peer views |
| `lib/content-guard.ts` | new | Medical-advice blocking |
| `services/circle-sync.ts` | modify | Add `school_class` derivation |
| `services/notifications.ts` | modify | Dedup, batching, outbox, digest, `circle_reply` |
| `lib/author.ts` | modify | `school_class` label, review and topic author views |
| `lib/notification-prefs.ts` | modify | New preference keys |
| `routes/circles.ts` | modify | Polls, topic tags, disclosure endpoints, peer views |
| `routes/me.ts` | modify | Saved items, contact details |
| `routes/activities.ts` | modify | Verified filter, rating and fee fields, sorting |
| `routes/schools.ts` | modify | Profile, reviews, fees, ask-parents |
| `index.ts` | modify | Mount new route groups |

## Mobile — `apps/mobile/app/`

| Path | Status |
|------|--------|
| `(app)/market/index.tsx`, `[id].tsx`, `new.tsx`, `mine.tsx` | new |
| `(app)/topics/index.tsx`, `[slug].tsx` | new |
| `(app)/schools/index.tsx`, `[id].tsx`, `compare.tsx`, `review.tsx` | new |
| `(app)/calendar.tsx`, `calendar/new.tsx` | new |
| `(app)/saved.tsx` | new |
| `(app)/activities/review.tsx` | new |
| `(provider)/reviews.tsx`, `(provider)/verification.tsx` | new |
| `src/components/DisclosurePrompt.tsx` | new |
| `(app)/_layout.tsx` | modify — Market tab, Alerts moved to header |
| `(app)/index.tsx` | modify — school-class section, week strip |
| `(app)/messages/[conversationId].tsx`, `messages/index.tsx` | modify — disclosure |
| `circles/[circleId]/new-post.tsx` | modify — poll composer, topic picker |
| `circles/[circleId]/index.tsx`, `posts/[postId].tsx` | modify — polls, topics, save |
| `src/components/circles/ui.tsx` | modify — `PollCard`, topic chips, save toggle |
| `src/constants/circles.ts` | modify — `school_class` label |
| `src/lib/api.ts` | modify — all new endpoints and types |

---

# 9. Testing priorities

Ordered by consequence of failure.

| Priority | Area | Must verify |
|----------|------|-------------|
| 1 | Topic feed visibility | The `circle_members` join is present and no cross-circle leak is possible |
| 2 | Disclosure | Levels are mutual, scoped per conversation, and never affect feed identity |
| 3 | Carpool disclosure gate | An arrangement cannot activate with any participant below level 3 |
| 4 | Child data | No endpoint at any disclosure level returns `children.nickname` |
| 5 | Notification dedup | A multi-circle post produces exactly one notification per recipient |
| 6 | Poll integrity | One vote per parent; results hidden in small circles |
| 7 | Saved items | Visibility rechecked on read after leaving a circle |
| 8 | Content guard | Symptom and medication text blocked before save |
| 9 | Circle sync | Grade progression moves membership cleanly with no orphans |
| 10 | Fee aggregation | Fewer than three reports publishes nothing; outliers do not distort |

Items 1 through 4 are privacy invariants. They warrant automated tests that fail the build, not manual checks.
