# Signup performance plan

## Goal

Reduce the measured signup-to-feed critical path without weakening password security or changing product behavior.

Production baseline after moving Vercel, Supabase, and Redis to Mumbai:

| Access network | Baseline | Target after this plan | Measured after phases 1–5 |
| --- | ---: | ---: | ---: |
| Same connection as test machine | 1.7 s | 1.1–1.3 s | 1.1 s |
| Good 4G / LTE | 2.5 s | 1.6–1.9 s | 1.7 s |
| 3G / HSPA | 4.6 s | 3.0–3.5 s | 3.3 s |

Source: `RUNS=5 node scripts/signup-speed-test.mjs`, 11 September 2026.

Server time p50 after the same phases:

| Endpoint | Baseline | Now |
| --- | ---: | ---: |
| `GET /v1/me/feed` | 236 ms | 81 ms (p95 125 ms) |
| `POST /v1/auth/register` | 288 ms | 348 ms (bcrypt, unchanged by design) |
| `GET /v1/reference/curricula` | 4 ms, uncacheable | 3 ms, `x-vercel-cache: HIT` |
| `GET /v1/reference/postal-countries` | 18 ms, uncacheable | 2 ms, `x-vercel-cache: HIT` |

The signup critical path is down to 9 sequential legs and 10 requests, from 12
legs and 17 requests, with no change to the screens or their order.

Known remaining cost: the enriched `POST /v1/me/children` response is 2.5 KB and
is served uncompressed, worth roughly 0.1 s on 3G.

## Before changing performance code

- [ ] Update the worker `DATABASE_URL` to the Supabase session pooler (`:5432`).
- [ ] Update the realtime service `DATABASE_URL` to the same Supabase session pooler.
- [ ] Keep the existing Upstash `REDIS_URL`; it is already in `ap-south-1`.
- [ ] Rotate the exposed Supabase database password and update every environment using it.
- [ ] Verify login, feed, post creation, replies, worker notifications, and realtime delivery.
- [ ] Keep Neon available as a rollback source until production verification passes.

## Phase 1 — Remove onboarding duplicate requests

This is the highest-return code change.

### 1. Route a newly registered parent directly to location

Files:

- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/src/lib/auth-navigation.ts`

Current behavior:

1. `POST /v1/auth/register` creates a brand-new user.
2. `routeAfterAuth()` immediately calls location and children endpoints.
3. Both results are already known for a new account: no location and no children.

Change:

- After password registration for a parent, save the session and route directly to `/onboarding/location`.
- Continue using `routeAfterAuth()` for login and existing Google/Apple accounts because their onboarding state is not necessarily new.
- If Google/Apple auth can report whether the account was just created, add `isNewUser` to the auth response and use the same direct route only when it is true.

Expected saving: one sequential leg and two requests, approximately 100–120 ms on good 4G.

### 2. Carry onboarding state between screens

Files:

- `apps/mobile/src/lib/onboarding-draft.ts`
- `apps/mobile/src/lib/auth-navigation.ts`
- `apps/mobile/app/onboarding/location.tsx`

Current behavior:

- `resolveParentOnboardingHref()` loads location.
- The location screen loads the same location again.

Change:

- Extend the in-memory onboarding draft to hold:
  - `location`
  - `locationLoaded`
  - `children`
  - `curricula`
  - `circles`
- When `resolveParentOnboardingHref()` loads location/children, put them in the draft.
- The location screen uses the draft when `locationLoaded === true`; fetch only when entering the screen without cached state.
- Clear the entire draft after onboarding completes or the user signs out.

Expected saving for resumed onboarding: one request, approximately 90–110 ms on good 4G.

### 3. Return completion data with child creation

Files:

- `apps/api/src/routes/me.ts`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/app/onboarding/class.tsx`
- `apps/mobile/app/onboarding/ready.tsx`

Current behavior:

1. `POST /v1/me/children`
2. `GET /v1/me`
3. Ready screen calls `GET /v1/circles` and `GET /v1/me`
4. Home screen requests user, circles, and children again

Change the child-create response from only a child to:

```ts
type AddChildResult = {
  child: Child;
  user: AuthUser;
  circles: Circle[];
};
```

The API already has the same transaction open and has just synchronized circle membership. Before returning:

1. Load the created child.
2. Load the updated user.
3. Load the user's circles.
4. Return all three together.

The mobile app then:

- saves the returned user in the session;
- stores `circles` and the child in the onboarding draft/query cache;
- removes the separate `GET /v1/me` from `class.tsx`;
- renders `ready.tsx` from the returned circles;
- seeds the home-screen cache so user/circles/children are not immediately downloaded again.

Expected saving: three to five requests and approximately 200–300 ms on good 4G.

### Phase 1 acceptance checks

- [ ] Fresh password registration goes directly to Location.
- [ ] Existing incomplete users resume on the correct screen after login.
- [ ] Google and Apple existing accounts still resume correctly.
- [ ] Ready screen displays the correct number of circles.
- [ ] Home screen displays the correct user, child, and circles.
- [ ] Relaunching the app mid-onboarding still works when the memory cache is empty.

## Phase 2 — Cache static reference data

### Server caching

File: `apps/api/src/routes/reference.ts`

Add long-lived cache headers:

```ts
const STATIC_REFERENCE_CACHE =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
```

Apply it to:

- `GET /v1/reference/postal-countries`
- `GET /v1/reference/curricula`

Use a shorter TTL for postal-code lookup results, for example:

```text
public, max-age=3600, s-maxage=86400
```

Do not cache authenticated or user-specific routes publicly.

### Mobile caching

Add `apps/mobile/src/lib/reference-cache.ts`:

- Save postal countries and curricula in AsyncStorage.
- Return cached data immediately.
- Refresh in the background when older than 24 hours.
- Store a cache version so a future schema change can invalidate old values.

Update these callers to use the cache:

- `apps/mobile/app/onboarding/location.tsx`
- `apps/mobile/app/onboarding/class.tsx`
- other curriculum selectors

Expected saving on a warm signup: two sequential network legs, approximately 200 ms on good 4G.

### Phase 2 acceptance checks

- [ ] First launch downloads and stores reference data.
- [ ] Second launch can render Location and Class with the API unavailable.
- [ ] Reference endpoint responses contain the expected cache header.
- [ ] User-specific endpoint responses remain private/non-cacheable.

## Phase 3 — Optimize the home feed

Measured server time: approximately 259 ms p50.

Files:

- `apps/api/src/services/feed.ts`
- `apps/api/src/lib/author.ts`

Main issue:

`hydrateHomeFeedPosts()` calls `buildAuthorViewForCircleAccess()` once for every post. That function performs two database lookups. A 20-post page can therefore add about 40 small queries after the main feed query.

Change:

1. Add `buildAuthorViewsForCircleAccess()` accepting all `(authorId, circleId)` pairs.
2. Load circle memberships for every pair in one query.
3. Load the author context labels in one query.
4. Build a map keyed by `authorId + circleId`.
5. Replace the per-post asynchronous author lookup with map reads.
6. Load attachments, topics, circles, helpful state, member counts, and polls concurrently where they do not depend on each other.
7. Batch poll hydration across all circle IDs instead of looping and awaiting one circle at a time.

Before adding indexes, run `EXPLAIN (ANALYZE, BUFFERS)` for:

- `MEMBER_HOME_FEED_SQL`
- `DISCOVERY_HOME_FEED_SQL`

Add an index only when the plan shows a real sequential scan or expensive sort. Avoid speculative indexes on the current tiny dataset.

Target: feed server time below 120 ms p50 and 200 ms p95.

## Phase 4 — Understand registration cost before changing it

Measured server time: approximately 288 ms p50.

File: `apps/api/src/routes/auth.ts`

Registration includes:

- unique-email lookup;
- anonymous-handle generation;
- `bcryptjs` hashing at cost 10;
- user insert and JWT creation.

Do not reduce bcrypt cost merely to improve a one-time signup.

Add timing around those four operations first. If hashing dominates:

- compare native `bcrypt` or Node's built-in `scrypt` in a benchmark;
- preserve support for existing bcrypt hashes;
- store an algorithm/version prefix for future password upgrades;
- rehash existing passwords only after a successful login.

Target: registration below 350 ms p50 is acceptable. Feed and duplicate-call work has higher priority.

## Phase 5 — Network resilience

File: `apps/mobile/src/lib/api.ts`

The shared request function currently has no timeout or retry policy.

Add:

- 10-second timeout using `AbortController`;
- one retry for transient network failures and HTTP 502/503/504;
- retries only for idempotent GET requests by default;
- no automatic retry for registration, location update, or child creation unless an idempotency key is implemented;
- a user-friendly offline/retry error.

This does not reduce normal p50 latency, but prevents slow networks from leaving onboarding stuck indefinitely.

## Verification after each phase

Run:

```bash
TEST_API_URL=https://api.vaara.ai RUNS=5 \
  node scripts/signup-speed-test.mjs
```

Record:

- same-link, 4G, 3G, and 2G projected totals;
- register and feed server p50/p95;
- number of sequential legs;
- request count;
- duplicate GET report;
- `x-vercel-id`, which must remain `bom1::bom1::...`.

Also test manually with iOS Network Link Conditioner or Android Emulator:

1. Start from a logged-out state.
2. Register.
3. Complete Location, School, and Class.
4. Confirm Ready renders.
5. Confirm the first feed renders.
6. Force-close and reopen during every onboarding step.
7. Repeat with 3G latency and packet loss enabled.

## Implementation order

1. Finish worker/realtime cutover and rotate credentials.
2. Phase 1: remove duplicate requests.
3. Phase 2: cache reference data.
4. Re-run the five-run production measurement.
5. Phase 3: batch feed hydration.
6. Instrument registration; optimize only if measurements justify it.
7. Add request timeout/retry behavior.

## Status

Phases 1–5 are implemented and the API is deployed to production (`bom1`).

Still open:

- [ ] Ship the mobile changes via EAS update or a new build.
- [ ] Worker `DATABASE_URL` cutover to the Supabase session pooler.
- [ ] Realtime `DATABASE_URL` cutover to the same pooler.
- [ ] Rotate the exposed Supabase database password.
- [ ] On-device verification with Network Link Conditioner at 3G with packet loss.

Note for future changes to author context: `getAuthorContextForCircle` and
`buildAuthorViewsForCircleAccess` share one matching implementation
(`contextLabelFromChildren`). Keep it that way so single-post and feed author
labels cannot diverge.

