# Home feed freshness and impression tracking

## Status

Implementation specification. Release 1.1 stabilization, impression
collection, and freshness ranking (behind `HOME_FEED_FRESHNESS`) are in
code. Ranking stays off until that flag is set explicitly.

The circle-timeline and cross-post deduplication foundation was deployed in
commit `ba8bce2`. This document defines the stabilization work required for
that release and the next freshness release.

## Product outcome

Home must answer two different questions:

1. What is new in circles this parent belongs to?
2. If there is nothing else new there, what useful conversation can this
   parent discover elsewhere?

A post can be attached to multiple circles, but it must remain one Home card.
The identity of a Home card is always `circle_posts.id`, never a
`circle_post_targets` row or circle ID.

The intended order is:

1. Unseen posts from the parent's circles.
2. Unseen, relevant discovery posts.
3. Previously seen posts from the parent's circles.
4. Previously seen discovery posts, if historical pagination continues that
   far.

Within member phases, order by `(created_at DESC, post_id DESC)`. Within
discovery phases, keep the documented relevance order and use a complete
keyset cursor for every ordered field.

## Concrete example

Parent-SLBG belongs to CBSE Parents, CBSE Grade 4, Gaudium, Gaudium CBSE
Grade 4, and locality 502032.

Assume:

- Two member-circle posts have never appeared on this parent's screen.
- Twenty older member-circle posts have appeared before.
- Three relevant discovery posts have never appeared.

Home returns:

```text
1–2    unseen member posts
3–5    unseen discovery posts
6–20   previously seen member posts
```

If there are twenty unseen member posts, the first page can contain all twenty.
Discovery begins after the unseen member phase is exhausted. This satisfies
the rule: discovery is promoted when the parent's own circles have no more
unseen posts, not merely when the database contains fewer than twenty member
posts.

On first use, the parent has no impressions. Existing posts in their own
circles are therefore unseen and appear first. This is desirable: a newly
onboarded parent first sees the useful content seeded into their most relevant
circles.

## Current production behavior

As of commit `ba8bce2`:

- Postgres is authoritative for post content.
- Redis stores a newest-500 ID timeline per circle.
- Home merges timelines for circles the viewer belongs to.
- SQL discovery fills the page after member candidates are exhausted.
- Cross-post candidates are deduplicated by post ID.
- There is no Home impression state, so the API cannot distinguish a post the
  parent viewed yesterday from one they have never seen.

The current algorithm is quantity-based:

```text
member posts until page is full
then discovery
```

This means twenty old member posts can keep a new discovery post off the first
page. Freshness changes that to:

```text
unseen member
then unseen discovery
then seen history
```

## Current production stabilization

The deployment of `ba8bce2` completed successfully, but the following must be
corrected before freshness work:

1. `CIRCLE_TIMELINE` and `HOME_FEED_TIMELINE` are absent in Vercel production.
   The committed code defaults both to `on`, so Redis reads activated
   immediately. Code defaults must be `off`; production activation must always
   be explicit.
2. Configure both production flags as `shadow` and redeploy. Shadow mode
   computes Redis and SQL results, serves SQL, and logs differences.
3. `038_circle_timeline_index.sql` must set
   `circle_post_targets.post_created_at DEFAULT now()`. Supabase already has
   this manual fix; the migration must describe the same schema for new
   environments.
4. Remove automatic loading of `.vercel/.env.production.local` from API,
   worker, and database client code. Local execution may load repository-root
   `.env.local`, but it must never silently choose production credentials.
5. Add parity, fallback, duplicate, and tuple-cursor tests before explicitly
   setting either timeline flag to `1`.

## What “seen” means

A post is seen only when its card is actually visible on the Home screen.

The following do not count as seen:

- The API returned the post below the fold.
- React Query prefetched a page.
- The post exists in a Redis candidate list.
- The parent opened a circle that contains the post, unless separate
  circle-surface impression tracking is added later.

The following counts as seen:

- At least 50% of the Home card remains visible for at least 750 ms.

The server records time using its own clock. Client timestamps are not used
for ranking.

Only Home impressions are in scope. Circle-feed impressions, dwell time,
scroll depth, reactions, and recommendation-model training are out of scope.

## Data model

Add migration `039_home_feed_impressions.sql` and register it in
`packages/db/src/migrate.ts`.

```sql
CREATE TABLE feed_post_impressions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_feed_post_impressions_user_last_seen
  ON feed_post_impressions (user_id, last_seen_at DESC, post_id);
```

Rules:

- One row per `(user_id, post_id)`.
- Cross-post placements do not create additional rows.
- Deleting a user or post removes impressions automatically.
- Do not store post bodies, circle names, client IPs, dwell time, or device
  details in this table.
- Do not add Redis per-user seen sets initially. Postgres is sufficient at the
  current scale and is easier to keep correct.

`last_seen_at` supports future “show this again after a long time” behavior.
Initial freshness requires only existence of the row.

## Impression API

Add:

```text
POST /v1/me/feed/impressions
Authorization: Bearer <token>
Content-Type: application/json

{
  "postIds": ["uuid", "uuid"]
}
```

Contract:

- Require authentication.
- Require an array.
- Deduplicate IDs in memory.
- Accept at most 50 IDs per request.
- Reject malformed UUIDs with HTTP 400.
- Insert only IDs that currently exist in `circle_posts`.
- Use one set-based query, not one query per post.
- Upsert `last_seen_at = now()` while preserving `first_seen_at`.
- Return HTTP 204 without revealing which submitted IDs existed.
- A write failure must be logged, but mobile must not block or invalidate Home.

Suggested SQL:

```sql
INSERT INTO feed_post_impressions
  (user_id, post_id, first_seen_at, last_seen_at)
SELECT $1, p.id, now(), now()
FROM circle_posts p
WHERE p.id = ANY($2::uuid[])
ON CONFLICT (user_id, post_id)
DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
```

Submitting an arbitrary existing post ID can only change the authenticated
user's own feed ranking. It grants no access and returns no existence details.
Do not add a feed-delivery/session table merely to validate impressions in
this release.

## Mobile collection

Home already renders a React Native `FlatList` in
`apps/mobile/app/(app)/index.tsx`.

Add:

- A stable `onViewableItemsChanged` callback held by `useRef`.
- `viewabilityConfig` with `itemVisiblePercentThreshold: 50` and
  `minimumViewTime: 750`.
- A session-level `Set<string>` of IDs already accepted for batching.
- An in-memory pending set.
- Flush when pending reaches 20 IDs, after approximately two seconds, and when
  the app moves to the background.
- Send at most 50 IDs per request.
- On network failure, return IDs to the pending set and retry on the next
  flush while the process remains alive.
- Clear timers on unmount.

The callback receives only post rows because header content is not part of the
`data` array. Impression delivery must be fire-and-forget and must not:

- Delay first paint.
- Trigger Home query invalidation.
- Show an error toast.
- Mark an authentication failure as a generic network retry forever.

Add `api.recordHomeFeedImpressions(token, postIds)` in
`apps/mobile/src/lib/api.ts`.

## Feed phases

Replace the current two Home phases (`primary`, `discovery`) with four
versioned phases:

```text
member_unseen
discovery_unseen
member_seen
discovery_seen
```

The server fills one response by walking phases in that order until it has
`limit` unique posts or all phases are exhausted.

### Phase 1: unseen member posts

Candidate IDs come from the viewer's Redis circle timelines when enabled.
Merge all circle candidates by `postId` and select the best display circle
using the existing circle-rank rule.

Exclude candidates with an impression row for this user. Apply membership,
curriculum-PIN, and access rules before choosing the final rows. Hydrate only
the bounded candidate set required to fill the page.

If Redis is cold, unavailable, or exhausted, use the equivalent member SQL.
Redis failure must never produce an empty feed when Postgres has eligible
posts.

### Phase 2: unseen discovery

Discovery remains SQL. Add:

```sql
LEFT JOIN feed_post_impressions fpi
  ON fpi.user_id = $1 AND fpi.post_id = p.id
```

and require `fpi.post_id IS NULL`.

Continue excluding a discovery post when any of its target circles is already
a member circle for the viewer. Rank using the existing relevance tiers:

1. Same PIN.
2. Same curriculum.
3. Other eligible posts.

Then helpful count, creation time, and post ID.

Before implementation, lock one product rule in tests: whether tier 3 is
globally visible or restricted by circle/access mode. Current production
permits broad discovery. The code and documentation must agree.

### Phase 3: seen member history

Use the same member eligibility and circle-rank rules, but require an
impression row. Order by original post creation tuple, not `last_seen_at`, so a
refresh does not continually move cards.

### Phase 4: seen discovery history

Use the same discovery eligibility and relevance ranking while requiring an
impression row. This preserves historical pagination. It may be omitted from
the initial UI only if Home intentionally ends after seen member history; do
not accidentally make it unreachable through a cursor bug.

## Deduplication

Deduplication is required in every phase and across phase boundaries.

Use a response-level `Set<postId>`:

```text
candidate has already been returned in this response → skip
candidate has not been returned → append and record postId
```

The SQL discovery anti-join prevents the normal member/discovery duplicate at
candidate selection. The response-level set is a defensive guarantee.

Apply the page limit after deduplication. If filtering leaves fewer than
`limit`, continue walking the current phase and then later phases. Do not
return 18 cards merely because two of the first 20 candidates were duplicates.

## Cursor contract

The current discovery ordering includes relevance and helpful count, but its
cursor contains only creation time and post ID. That is not a complete keyset
cursor and can skip or repeat rows when relevance/helpful values differ.

Introduce a versioned opaque Home cursor. One possible encoding is:

```text
v2.<base64url-json>
```

Member payload:

```json
{
  "phase": "member_unseen",
  "asOf": "2026-09-14T02:00:00.000Z",
  "createdAt": "2026-09-14T01:30:56.293Z",
  "postId": "uuid"
}
```

Discovery payload:

```json
{
  "phase": "discovery_unseen",
  "asOf": "2026-09-14T02:00:00.000Z",
  "relevance": 1,
  "helpfulCount": 3,
  "createdAt": "2026-09-14T01:12:56.427Z",
  "postId": "uuid"
}
```

Rules:

- Cursor is exclusive.
- `asOf` is fixed on the first page and carried through pagination. Posts
  created afterward appear on refresh, not halfway through the current scroll.
- Member keyset order is `(created_at DESC, post_id DESC)`.
- Discovery keyset order is
  `(relevance ASC, helpful_count DESC, created_at DESC, post_id DESC)`.
- When a response crosses a phase boundary, its next cursor represents the
  last emitted row in the phase where the response ended.
- Continue parsing legacy `p|...` and `d|...` cursors during one mobile-release
  compatibility window. Treat them using the old behavior; issue only v2
  cursors in new responses.
- Mobile continues treating the value as opaque.

## Impression writes during pagination

Impression writes are expected while the parent scrolls.

Example:

1. API returns unseen posts 1–20.
2. Parent views posts 1–5; mobile records those impressions.
3. The client already owns posts 6–20 in its loaded first page.
4. The next cursor starts after post 20, so changing posts 1–5 to seen does not
   cause duplication.
5. Pull-to-refresh starts a new `asOf` snapshot. Posts 6–20 remain unseen if
   they never entered the viewport and can be ranked accordingly.

Do not invalidate or refetch Home after an impression write.

## Redis responsibilities

Redis continues to maintain only shared circle timelines:

```text
timeline:v1:{circleId}
```

Do not add:

```text
home:{userId}
seen:{userId}
discovery:global
discovery:curriculum:*
discovery:pin:*
```

in this release.

The same post ID may legitimately appear in several circle timelines. Home
merges those shared lists by post ID. This is not duplicate stored content and
does not require deleting the ID from any valid circle timeline.

Discovery stays in SQL because its selection is viewer-specific and currently
runs only after unseen member content is exhausted.

## Failure behavior

| Failure | Required behavior |
|---|---|
| Redis unavailable | Use SQL member queries; Home still returns posts |
| Impression endpoint unavailable | Home renders normally; mobile retries later |
| Impression write lost when app is killed | Post may be treated as unseen again; no content loss |
| Duplicate impression request | Idempotent upsert; one row per user/post |
| Post deleted after being queued | `INSERT ... SELECT` ignores it; FK cascade removes prior impressions |
| Redis timeline missed a write | Outbox retries; SQL fallback preserves correctness |
| Read replica missing a fresh post | Retry hydration on primary as in the timeline design |
| Malformed cursor | Return HTTP 400 or safely restart according to the existing API convention; never execute partial cursor ordering |

## Query and scale considerations

At the current scale, Postgres impressions are inexpensive. Before larger
traffic:

- Inspect `EXPLAIN (ANALYZE, BUFFERS)` for unseen member and discovery queries.
- Confirm anti-joins use the `(user_id, post_id)` primary key.
- Avoid aggregating helpful marks over the entire table if discovery latency
  grows; aggregate only candidate post IDs or maintain a counter.
- Bound Redis over-fetch and hydrate only selected candidates.
- Monitor impression endpoint request rate and batch size.

Potential future growth is proportional to viewed user/post pairs. Revisit
retention or partitioning only after measured table growth justifies it.
Deleting old impression rows makes old posts “unseen” again, so retention must
be a product decision, not an automatic cleanup.

## Rollout

### Release 1.1: stabilize timeline deployment

1. Change timeline code defaults to `off`.
2. Remove `.vercel/.env.production.local` fallback loading.
3. Record the `post_created_at DEFAULT now()` migration behavior.
4. Add timeline parity, deduplication, cursor, and Redis-fallback tests.
5. Set production timeline flags explicitly to `shadow`.
6. Deploy and observe SQL/Redis ID differences and timeline outbox lag.
7. Set flags explicitly to `1` only after shadow parity is clean.

### Release 2A: collect impressions without ranking changes

1. Apply migration `039`.
2. Deploy the API endpoint.
3. Release mobile viewport batching.
4. Keep current Home ordering.
5. Verify that impressions arrive, batch sizes remain bounded, duplicate
   submissions are harmless, and first paint is unchanged.

### Release 2B: enable freshness ranking

1. Deploy four-phase server composition and v2 cursors.
2. Start in SQL mode and verify expected ordering with fixture users.
3. Run Home timeline shadow comparison using phase-aware expected IDs.
4. Enable Redis member reads explicitly after parity is clean.

Do not combine impression collection and freshness ranking into one
unobservable release.

## Required tests

### API and database

1. First impression inserts one row.
2. Repeated impression preserves `first_seen_at` and updates `last_seen_at`.
3. Duplicate IDs in one request produce one row.
4. More than 50 IDs or malformed UUIDs return 400.
5. Deleted/nonexistent IDs do not create rows or reveal existence.
6. User A's impression does not affect User B.
7. Seeing one placement marks the cross-post seen everywhere.
8. Unseen member posts precede unseen discovery.
9. When no unseen member posts remain, unseen discovery precedes seen member
   history.
10. Seen member history remains available.
11. A member/discovery cross-post appears once.
12. Filtering continues until the requested number of unique posts is filled.
13. Same-timestamp posts paginate without repeat or omission.
14. Discovery relevance/helpful ties paginate without repeat or omission.
15. A post created after cursor `asOf` appears only after refresh.
16. Redis outage returns the equivalent SQL feed.
17. Cold/empty Redis timelines preserve the phase contract.
18. Curriculum PIN and guest/access behavior match the locked product rule.

### Mobile

1. A below-fold card is not reported.
2. A card visible less than 750 ms is not reported.
3. A card at least 50% visible for 750 ms is reported.
4. Multiple cards are batched.
5. The same card is not repeatedly sent during one Home session.
6. Failed sends return IDs to the pending batch.
7. Backgrounding flushes pending impressions.
8. Impression delivery does not invalidate Home or delay rendering.
9. Authentication failure does not create an infinite retry loop.

## Acceptance examples

### Parent-SLBG duplicate case

Given “Hello everyone” targets CBSE Parents and three Slate/Grade 5 circles,
and Parent-SLBG belongs to CBSE Parents:

- Member phase emits the post once.
- Discovery excludes the entire post because at least one target is a member
  circle.
- Circle chips may show all placements.
- Home displays one card.

### No new member posts

Given all member posts have impression rows and two relevant discovery posts
do not:

- The first Home cards are the two unseen discovery posts.
- Seen member history follows.

### One new member post

Given one member post is unseen, two discovery posts are unseen, and older
member history exists:

- The unseen member post is first.
- The two unseen discovery posts follow.
- Seen member history fills the remainder.

## Definition of done

- Home never returns the same `postId` twice in one paginated session.
- A downloaded but never visible card remains unseen.
- When member circles have no unseen posts, relevant unseen discovery appears
  before old member history.
- Redis failure does not make Home empty or return 500.
- Impression recording does not affect first paint.
- SQL and Redis member paths produce the same phase-aware post IDs.
- Production timeline modes are explicit environment values, not code
  defaults.
- Discovery remains SQL-backed until measurements justify a separate Redis
  discovery project.
