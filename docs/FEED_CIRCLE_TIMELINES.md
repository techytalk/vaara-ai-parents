# Feed circle timelines — IDs in Redis, bodies in Postgres

Stop rebuilding “which posts belong to this circle?” with a SQL join on
every Home and circle-feed read. Keep **one post row in Postgres**. Keep
**one shared ID list per circle in Redis**. Do not copy a post into 10,000
per-user inboxes.

Postgres remains the **source of truth**. Redis is a **rebuildable hot
index** of the newest ~500 post ids per circle. A missing, stale, or
failed Redis write must never hide a committed post.

A circle of 10,000 is a Facebook Group, not a Twitter follow graph. Members
read the same tray. Opening Home should merge a few circle lists and
hydrate ~20 cards — not rerun `posts ⋈ targets ⋈ members` for every
viewer.

This is an **API + Redis + one Postgres migration** change. Mobile
first-paint (`docs/HOME_FEED_FIRST_PAINT.md`,
`docs/POST_THREAD_FIRST_PAINT.md`) stays. Response objects stay the same
shape. `nextCursor` stays an opaque string; its encoding becomes a tuple
and old timestamp-only cursors must still parse.

### Final scheduling decision

Ship two phases. Do not turn Home onto Redis until Phase 1 has a warm
index, outbox recovery, and shadow diffs that stay clean.

1. **Phase 1 — safe circle hot window.** Create/delete write a Postgres
   outbox in the same transaction, then `ZADD` / `ZREM`. Circle
   `GET .../feed` reads IDs, hydrates by primary key, and falls back to
   SQL for cold keys, Redis outages, and history older than the 500-id
   cap. Retire per-viewer `feed:v1:{circleId}:{userId}` page-1 JSON.
2. **Phase 2 — Home primary merge.** `GET /v1/me/feed` pipelines each of
   the viewer’s circle timelines **from the Home cursor**, over-fetches,
   dedupes, applies the curriculum PIN rule, hydrates ~20. Keep today’s
   discovery SQL as filler only after **both** Redis merge and
   `MEMBER_HOME_FEED_SQL` are exhausted.
3. **Not this work.** Discovery / For You rewrite. Per-user
   `home:{userId}` fan-out. Topic-feed Redis. Mobile query-key changes.
   Ranking.

If Redis is down, serve today’s SQL. A cache outage must never 500 a
feed.

## Locked design rules

These replace the gaps in the first draft. Do not implement around them.

1. **Redis is not authoritative.** A warm ZSET that missed a `ZADD` is a
   bug to repair, not “eventual consistency we accept.”
2. **Order is `(created_at DESC, id DESC)`** in Redis, SQL, and cursors.
   Never paginate on timestamp alone.
3. **The 500-id ZSET is a hot window, not the whole feed.** Older pages
   continue from SQL. `nextCursor` is null only when SQL also returns
   fewer than `limit` rows.
4. **Cold ≠ empty.** `ZCARD` cannot tell them apart. Use a separate
   ready/meta key. An empty circle still gets `ready=1`.
5. **Backfill never `DEL`s a live key.** Only `ZADD` / merge / cap.
   Single-flight with `SET NX`.
6. **Home does not `ZREVRANGE 0 49`.** Every circle is read with the
   same exclusive tuple cursor and over-fetch loop.
7. **One migration is in scope:** ordered target index plus
   `timeline_outbox`.
8. **Hydrate is still the expensive part.** Batch it. Retry recent
   misses on the primary. Skip ghosts and keep walking IDs.

## Why (current vs next)

### What we have now

Postgres is the only index. Redis is a short-lived **copy of page-1 JSON**.

| Surface | Today |
|---|---|
| Create | `circle_posts` + `circle_post_targets`, then `invalidateCircleFeedCache` (SCAN/DEL `feed:v1:{circleId}:*`) and `PUBLISH post.new` |
| Circle feed | If no cursor and Redis up: `GET feed:v1:{circleId}:{userId}:{scope}:page1`. Miss → `loadCircleFeed` SQL join → `SET` JSON for 120s |
| Home | Always `loadHomeFeed` SQL. No Redis. Member join, then discovery filler |
| Edit / reply | Same `invalidateCircleFeedCache`. ID list does not exist, so we delete JSON instead of patching it |
| Vote / helpful | Do **not** invalidate. Cached page-1 JSON can show stale counts until TTL |

`dispatchPostCreated` (`apps/api/src/lib/async-events.ts`) already runs
after commit. It enqueues notifications and publishes realtime. It does
**not** append the new post to a shared list. Circle create already
`RETURNING created_at` (`apps/api/src/routes/circles.ts`) but does not
pass it to dispatch. Cross-post insert currently `RETURNING id` only
(`apps/api/src/services/cross-posts.ts`).

`GET /v1/circles/:circleId/feed` (`apps/api/src/routes/circles.ts`) is the
only reader of `feedCacheKey` / `getCachedJson` / `setCachedJson` in
`packages/redis/src/cache.ts`.

Home (`GET /v1/me/feed` → `loadHomeFeed` in `apps/api/src/services/feed.ts`)
runs `MEMBER_HOME_FEED_SQL`:

```sql
circle_posts
  JOIN circle_post_targets
  JOIN circle_members  -- viewer’s circles
```

Cursor today is `created_at` only (`p.created_at < $cursor`). Ties can
already skip or repeat; this pass fixes that on both paths.

Then, if the primary page is short, `DISCOVERY_HOME_FEED_SQL` (posts in
circles the viewer is **not** in). Curriculum circles also require a
shared PIN (or self).

So 2,000 School A parents opening Home = 2,000 of those joins. Redis
does not hold “School A’s latest post ids.”

### What we upgrade to

```
Priya posts in School A
        │
        ▼
  Postgres (same transaction):
    circle_posts + circle_post_targets
    timeline_outbox (op=add)
        │
        ▼  after COMMIT
  Redis: ZADD timeline:v1:{schoolA}  <score>  <postId>
         update meta watermark
         mark outbox done  (or worker retries)
  PUBLISH circle:schoolA post.new
        │
        ├── Circle GET  → member? → IDs from ZSET or SQL → hydrate
        └── Home GET    → merge circle ID lists from cursor → hydrate
```

2,000 parents in the same minute share one circle ID list. Each request
still hydrates ~20 cards. That hydrate must be batched; it is no longer
a membership join, but it is still real Postgres work.

## Redis keys

Add these in `packages/redis`. Do not reuse `feed:v1:...` — that key is
**per viewer** and stores full JSON. Timelines are **per circle** and
store ids.

| Key | Type | Contents |
|---|---|---|
| `timeline:v1:{circleId}` | ZSET | member = `postId`; score = `created_at` as Unix **ms**; newest **500** (`ZREMRANGEBYRANK` 0 to -501 after writes) |
| `timeline:v1:{circleId}:meta` | HASH | `ready=1`, `maxAt` (ISO), `maxId`, `count`, `updatedAt` |
| `timeline:v1:{circleId}:lock` | STRING | backfill single-flight; `SET NX EX 30` |
| `postcard:v1:{postId}` | STRING JSON | optional Phase 1.5 shared card; TTL 30s; **no** viewer overlays |

`ZCARD` on a missing key and an empty key are both 0. Redis also deletes
a ZSET when the last member is removed. **Never** use `ZCARD` to decide
cold vs empty. Use `meta.ready`.

- Missing `meta` → **cold**. Backfill (or SQL fallback).
- `meta.ready=1` and no ZSET / `ZCARD=0` → **empty circle**. Return `[]`
  without SQL.
- `meta.ready=1` and ZSET present → **hot window**. Read IDs from Redis.

Do **not** store body, media, author, poll, or replyCount in the ZSET.

Keep existing keys:

- `feed:v1:*` — stop **writing** in Phase 1. `DEL` leftovers on write
  paths during rollout so old JSON cannot win.
- `topic-feed:v1:*` — still unused; do not start writing them.
- BullMQ, rate-limit, pub/sub channels — unchanged.

Env:

| Variable | Default | Meaning |
|---|---|---|
| `REDIS_URL` | unset = SQL only | existing |
| `CIRCLE_TIMELINE` | `0` / `off` | Code default is off. `shadow` computes Redis+SQL and serves SQL. `1` serves Redis. Set explicitly in production. |
| `HOME_FEED_TIMELINE` | `0` / `off` | Same as circle. Do not rely on an implicit `on` default. |
| `HOME_FEED_FRESHNESS` | `0` | Collect impressions anytime. Set `1` to rank unseen member, unseen discovery, then seen history. |
| `CIRCLE_TIMELINE_MAX` | `500` | ZSET cap |

## Cursor contract

Mobile already treats `nextCursor` as opaque
(`getNextPageParam: (lastPage) => lastPage.nextCursor`).

| Surface | Today | New |
|---|---|---|
| Circle feed | ISO `created_at` | `{createdAt}|{postId}` |
| Home primary | `p|{createdAt}` | `p|{createdAt}|{postId}` |
| Home discovery | `d|{createdAt}` | `d|{createdAt}|{postId}` (keep parsing `d|{createdAt}`) |

Parse both shapes. A timestamp-only cursor means
`(created_at, id) < (cursorAt, +infinity)` — exclusive on time, same as
today.

Exclusive next-page predicate (DESC):

```
created_at < cursorAt
OR (created_at = cursorAt AND id < cursorId)
```

After a Redis `ZREVRANGEBYSCORE` that is inclusive on `cursorAt` ms,
drop the cursor post and any same-ms member whose `id >= cursorId`.

SQL fallback / backfill **must** use:

```sql
ORDER BY p.created_at DESC, p.id DESC
```

Do not use `Date.now()` as a score. Always use the row’s `created_at`
from `RETURNING`.

## Postgres migration

`idx_circle_post_targets_circle_post` is `(circle_id, post_id)`. That
does **not** serve “latest 500 by created_at for this circle.”

Migration `packages/db/migrations/038_circle_timeline_index.sql`:

```sql
ALTER TABLE circle_post_targets
  ADD COLUMN IF NOT EXISTS post_created_at timestamptz;

UPDATE circle_post_targets t
SET post_created_at = p.created_at
FROM circle_posts p
WHERE p.id = t.post_id
  AND t.post_created_at IS NULL;

ALTER TABLE circle_post_targets
  ALTER COLUMN post_created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_post_targets_circle_created
  ON circle_post_targets (circle_id, post_created_at DESC, post_id DESC);

CREATE TABLE IF NOT EXISTS timeline_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op text NOT NULL CHECK (op IN ('add', 'remove')),
  post_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  post_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_timeline_outbox_pending
  ON timeline_outbox (created_at)
  WHERE processed_at IS NULL;
```

Every new `circle_post_targets` insert must set `post_created_at` to the
post’s `created_at` (same value written to Redis).

## Write path

Writes are **two-step**: durable intent in Postgres, then best-effort
Redis. Redis failure after commit is recovered by the outbox worker, not
by “the next GET backfills” (that only helps **cold** keys).

### Create

In the **same transaction** as `circle_posts` / `circle_post_targets`:

1. Insert one `timeline_outbox` row per target (`op=add`, `post_id`,
   `circle_id`, `post_created_at`).

After **COMMIT**, `dispatchPostCreated`:

1. Take `createdAt` from `RETURNING` (add it to the dispatcher and to
   `dispatchCrossPostsCreated`). Cross-post INSERT must
   `RETURNING id, created_at`.
2. `ZADD` each `timeline:v1:{circleId}` with that timestamp. Idempotent.
3. Cap 500.
4. Update `meta` watermark (`maxAt`, `maxId`, `count`). If `meta` is
   missing, do **not** invent a full timeline — leave it cold so the next
   GET backfills, **and** still `ZADD` so a concurrent backfill can merge.
5. Mark matching outbox rows `processed_at = now()`.
6. `publishCircleEvent({ type: "post.new" })` (already there).
7. `DEL feed:v1:{circleId}:*` so leftover JSON cannot outrank the list.

If Redis throws: log `[redis:timeline] zadd failed`, leave outbox
pending, still publish `post.new`, still return 200 to the client.

### Delete

In the **same transaction** as `DELETE FROM circle_posts`:

1. Outbox `op=remove` for each target circle (read targets **before**
   delete; `ON DELETE CASCADE` removes them).

After commit: `ZREM`, bump/update `meta`, mark outbox done. Today delete
does not publish; keep that. Failed `ZREM` stays in outbox.

### Edit / reply / vote / helpful / save

No timeline write. `created_at` and id do not change. Hydrate returns
new body and counts. Still `DEL feed:v1:{circleId}:*` on edit/reply
until that JSON cache is gone.

### Outbox worker

Use existing `vaara-maintenance` (`packages/redis/src/queues.ts`).

- Drain `timeline_outbox WHERE processed_at IS NULL` every few seconds
  (or enqueue `timeline.sync` after a failed ZADD/ZREM).
- `add`: `ZADD` + meta.
- `remove`: `ZREM` + meta.
- Retry with attempts cap; then alert / structured error log.
- `ZADD` of the same member+score is safe.

Do **not** move the only ZADD into the worker as the happy path. The API
process still writes Redis so the author’s next GET is immediate. The
worker is recovery.

### Rebuild

Add `rebuildCircleTimeline(circleId)` (script or maintenance job):

1. Take lock.
2. SQL latest `CIRCLE_TIMELINE_MAX` rows via the new index.
3. `ZADD` those members (merge, no `DEL` first unless the operator
   passed `--replace` and the lock is held).
4. Set `meta.ready=1` and watermarks.
5. Support `--all` for ops after a Redis flush.

## Read path — Phase 1 circle feed

`GET /v1/circles/:circleId/feed` still returns `{ posts, nextCursor }`.

Flags: `CIRCLE_TIMELINE=0` keeps today’s SQL (+ existing JSON cache until
removed). `shadow` computes Redis IDs, serves SQL, logs the diff.
`1` serves Redis when hot.

### Algorithm

1. `assertCircleMember`. Non-members still 404. The timeline is not a
   bypass.
2. If Redis disabled or flag `0`: `loadCircleFeed` SQL with the new
   tuple order/cursor. Return.
3. If `meta` missing (**cold**):
   1. `SET timeline:v1:{circleId}:lock NX EX 30`.
   2. Winner: load latest 500 `(id, created_at)` from SQL, `ZADD` merge,
      set `meta.ready=1` (even when 0 rows). Return that page via the
      same hydrate path.
   3. Losers: short wait/retry `meta` (e.g. 3 × 50ms). If still cold,
      serve SQL and **do not** write Redis.
4. If `meta.ready=1` (**hot or empty**):
   1. Empty ZSET → `{ posts: [], nextCursor: null }`.
   2. Else `ZREVRANGEBYSCORE` from `+inf` or the cursor tuple, over-fetch
      (`limit * 4`, max 80) for curriculum `scope=local`.
   3. Apply exclusive tuple filter in process.
   4. Hydrate (below). Skip missing ids; if the visible page is short,
      walk the next ID window. Same loop as PIN filtering.
   5. If the hot window is exhausted (no more ZSET members before the
      cursor) **and** the client sent a cursor or `ZCARD >= cap`:
      continue from SQL with the same tuple cursor. Do not return
      `nextCursor: null` until SQL returns `< limit`.
5. Curriculum + `scope=local`: ZSET stays unfiltered. PIN filter after
   hydrate, then keep walking. Do not put PIN in the Redis key.

### Hydrate

New `hydrateCirclePosts(client, userId, circleId, postIds)` in
`apps/api/src/services/feed.ts`. Preserve ID-list order. Reuse
`loadPostAttachments`, `loadPostPolls`, `loadTopicsForPosts`,
`loadCirclesForPosts`, `buildAuthorViewForCircleAccess` (already batched).

**Replica lag:** feeds use `readPool`. If any id is missing and its
Redis score is newer than ~30s, retry **those ids** on `pool`
(primary). If still missing, treat as a ghost: omit, continue the ID
window, enqueue `op=remove` for that circle if the row is gone on
primary.

**Phase 1.5 (same release if cheap, else follow-up):** `postcard:v1:{id}`
for shared fields (body, media, author handle, replyCount, poll
aggregates). Viewer overlays (`myHelpful`, `myOptionId`) always SQL.
TTL 30s. Not required to flip `CIRCLE_TIMELINE=1`.

### Backfill SQL

```sql
SELECT pct.post_id AS id, pct.post_created_at AS created_at
FROM circle_post_targets pct
WHERE pct.circle_id = $1
ORDER BY pct.post_created_at DESC, pct.post_id DESC
LIMIT $2
```

Uses `idx_circle_post_targets_circle_created`.

## Read path — Phase 2 Home primary

`GET /v1/me/feed` still returns `{ posts, nextCursor }`.

`HOME_FEED_TIMELINE` defaults to `0` until Phase 1 shadow is clean.
`MEMBER_HOME_FEED_SQL` stays in the file as fallback for the rest of
the primary history and for flag `0`.

When `phase === "primary"` and flag is `1` or `shadow`:

1. Load the viewer’s circle ids + types. Do **not**
   `syncCircleMembership` (today’s Home does not).
2. Pipeline, **per circle**, `ZREVRANGEBYSCORE` with the exclusive
   Home tuple cursor — not `ZREVRANGE 0 49`.
3. Over-fetch (`limit * 4` ids per circle, or another window if the
   merged filtered set is short). Merge by `(created_at, id)` DESC.
4. Dedupe `postId`. When a post sits in more than one of the viewer’s
   circles, keep today’s type priority: school_class → class → school →
   community → locality → curriculum.
5. Curriculum PIN rule on curriculum-attributed rows (author is viewer,
   or shared `user_locations.pin_code`). Drop failures and keep
   walking.
6. Hydrate as `HomeFeedPost` (`circleId`, `circleName`, helpful, no
   `discovery`). Same replica/ghost rules as circle hydrate.
7. If after walking Redis windows the page is still short, run
   `MEMBER_HOME_FEED_SQL` with the **same tuple cursor** (update that
   SQL to `ORDER BY created_at DESC, id DESC` and the exclusive
   predicate). This is how page 2+ and posts older than 500 stay
   correct.
8. Only if **both** Redis merge and primary SQL return fewer than
   `limit` rows: fill with `DISCOVERY_HOME_FEED_SQL`. Discovery uses
   `before: null` on a mixed first page (same as
   `loadHomeFeed` today, lines 550–580). Do not reuse the `p|`
   timestamp as a discovery bound on that first mixed page.
9. `shadow`: serve the SQL result; log Redis-merge ids vs SQL ids.

## Observability

Structured logs / counters (no new vendor required in this pass):

| Name | When |
|---|---|
| `feed.path=sql\|redis\|hybrid\|shadow` | every feed GET |
| `timeline.zadd.fail` / `timeline.zrem.fail` | Redis write error |
| `timeline.outbox.retry` | worker drain |
| `timeline.backfill.ms` / `timeline.backfill.lock_miss` | cold populate |
| `timeline.hydrate.miss` | id in Redis, row missing |
| `timeline.fallback.sql` | hot window exhausted or Redis down |
| `timeline.shadow.diff` | id lists disagree |

`/health` stays a Redis ping. Do not make health fail because a
timeline is cold.

## Code changes by file

### Phase 1

| File | Change |
|---|---|
| `packages/db/migrations/038_circle_timeline_index.sql` | `post_created_at`, index, `timeline_outbox` |
| `apps/api/src/services/cross-posts.ts` | Set `post_created_at`; `RETURNING id, created_at`; insert outbox rows in the create transaction |
| `apps/api/src/routes/circles.ts` | Same for the older POST; feed GET uses timeline helper; delete inserts `remove` outbox then `ZREM` |
| `apps/api/src/lib/async-events.ts` | `createdAt` on `dispatchPostCreated`; `ZADD` + mark outbox; keep pub/sub and BullMQ notify |
| `apps/api/src/services/cross-posts.ts` (`dispatchCrossPostsCreated`) | Pass `createdAt` through |
| `packages/redis/src/timeline.ts` | **New.** keys, `add`/`remove`/`list`/`backfill`/`setMeta`/`acquireLock`, fail open |
| `packages/redis/src/index.ts` | Export helpers; optional `enqueueTimelineSync` on maintenance queue |
| `packages/redis/src/queues.ts` | `TimelineSyncJob` type if the API enqueues on write failure |
| `packages/redis/src/cache.ts` | Keep `invalidateCircleFeedCache` for leftover `feed:v1:` deletes |
| `apps/api/src/services/feed.ts` | Tuple cursor parse/encode; `hydrateCirclePosts`; SQL `ORDER BY created_at, id`; circle GET orchestration |
| `apps/worker/src/index.ts` | Drain `timeline_outbox` / `timeline.sync`; still no feed **read** path |
| `packages/db/scripts/rebuild_circle_timeline.ts` (or worker job) | Ops rebuild |

### Phase 2

| File | Change |
|---|---|
| `apps/api/src/services/feed.ts` | `loadHomeFeed` merge + SQL tail + discovery filler |
| `packages/redis/src/timeline.ts` | `listManyCircleTimelinesFromCursor` pipelined |

### Do not edit in this pass

- `apps/mobile` feed / thread / editor (opaque cursor still works)
- `apps/mobile/app/p/[shareId].tsx`
- `apps/realtime` (`post.new` stays ids only)
- Discovery ranking rewrite
- Topic feed cache
- Per-user `home:{userId}` ZSETs

`packages/db` **is** in scope for the one migration above.

## Visibility rules (unchanged product)

| Who | Circle feed | Home primary | Home discovery |
|---|---|---|---|
| Member of a target | Yes (PIN rule if curriculum + local) | Yes | No (already primary) |
| Non-member | 404 | No | Yes, ranked (still SQL) |
| Guest author into a circle they are not in | Members see it; author is `isGuest` | Author does **not** | Author excluded (`author_id <> viewer`) |
| Mutes / blocks | Notifications / thread only | Same | Same |

`access_mode` stays unused in feed SQL. Do not filter guest placements
out of the timeline unless product asks.

## Rollout

1. Deploy migration. Inserts start writing `post_created_at` + outbox.
   Flag stays `0` (SQL).
2. Deploy Phase 1 code. `CIRCLE_TIMELINE=shadow` in staging, then
   production. Serve SQL; fix every `timeline.shadow.diff`.
3. Flip `CIRCLE_TIMELINE=1` for a canary set if you add a circle-id
   allowlist; otherwise flip globally once shadow is clean. Kill switch
   is the env var.
4. Confirm outbox lag is ~0, hydrate misses are only replica-lag
   retries, and page 26+ on a large circle still returns SQL history.
5. Phase 2: `HOME_FEED_TIMELINE=shadow`, then `1`. Do not delete
   `MEMBER_HOME_FEED_SQL`.
6. Remove `setCachedJson` for circle feeds once nothing writes
   `feed:v1:`. Keep `invalidateCircleFeedCache` until SCAN traffic is
   gone (stop calling it on reply once JSON cache is dead — SCAN on
   every reply is the current Redis tax).

Local / no `REDIS_URL`: SQL only. `/health` `redis: false` is already
documented in `docs/REDIS.md`.

## Test plan

### Phase 1

1. Post in School A. Other member’s next circle GET shows it. Redis
   `ZSCORE` exists; outbox row is processed.
2. Cross-post to School A + locality. Both ZSETs contain the id.
3. Cold circle: first GET backfills ≤500 ids, sets `meta.ready=1`,
   matches SQL order.
4. Empty circle: `meta.ready=1`, no repeated SQL on the second GET.
5. Redis down: GET and create still 200; outbox remains pending; worker
   applies the ZADD when Redis returns.
6. **Warm-key miss:** create, then drop the ZADD (inject failure). Feed
   must show the post after the worker runs — not after waiting for a
   cold miss that never happens.
7. Two posts in the same millisecond: page 1 and page 2 neither skip
   nor repeat. Cursor includes `postId`.
8. Old ISO-only cursor still returns the next page (time-exclusive).
9. Curriculum + `scope=local`: other-PIN hidden; same-PIN and author
   visible.
10. Non-member: 404.
11. Delete: id removed from every target ZSET; failed ZREM is retried
    from outbox; hydrate skips a leftover ghost and still fills `limit`.
12. Edit / reply / vote: list unchanged; body and counts refresh.
13. Page 26+ on a circle with >500 posts: SQL tail, not an empty end.
14. Concurrent cold GET (stampede): one backfill, others wait or SQL;
    no `DEL` races with a concurrent create (`ZADD` merge).
15. Create then immediate GET with replica lag: missing id retries
    primary; post appears.
16. Guest post into an accepting circle: members see `author.isGuest`.
17. `CIRCLE_TIMELINE=shadow`: response equals SQL; diffs logged if
    Redis order disagrees.

### Phase 2

18. Home first page uses merge when flag is `1`; metric `feed.path`
    says so.
19. Home page 2+ with `p|{createdAt}|{postId}` does not jump to
    discovery while primary history remains.
20. Cross-post appears once, tightest circle type wins.
21. Curriculum PIN still hides other-PIN authors on primary.
22. Short primary → discovery filler; mixed first page uses discovery
    `before: null`.
23. Guest author does not see their guest post on primary Home.
24. Realtime `post.new` still invalidates mobile `["homeFeed"]` /
    `["circleFeed"]`.
25. Staging load: 2,000 concurrent circle GETs on one warm school —
    measure Redis commands **and** Postgres hydrate qps / pool wait.

## Out of scope reminders

- Do not fan out one post to 10,000 `home:{userId}` keys.
- Do not put full feed JSON back in Redis as the source of truth.
- Do not treat discovery as “SELECT posts WHERE NOT member” forever.
- Do not skip the migration. The existing target index is the wrong
  shape for backfill.
- Do not treat “next GET backfills” as recovery for a **warm** key.
