# Onboarding school search — speed

Decision / investigation doc for Step 2 (`/onboarding/school` + `SchoolPicker`).
Pairs with [`ONBOARDING_LOCATION_LOCALITY.md`](./ONBOARDING_LOCATION_LOCALITY.md).

**Status:** agreed direction, not yet implemented.  
**Date:** 15 September 2026.

---

## Problem

Parents report school search feels slow while typing. Nearby suggestions on an
empty field also show a spinner.

This is a **felt latency** problem on mobile networks, not a slow SQL query at
current scale.

---

## What we measured (Supabase, 15 Sep 2026)

| Check | Result |
| --- | --- |
| Schools in DB | **216** |
| Search SQL (`q=ga`, trigram + ILIKE) | **~5 ms** execution, seq scan OK at this size |
| Indexes | `gin_trgm` on `name` / `branch`, btree on `city` / `pin_code` |

Postgres is not the bottleneck today. When the catalog grows to tens of
thousands, the query shape still needs care — but that is not why onboarding
feels slow now.

---

## Why it feels slow

```
Keystroke → 300 ms debounce → HTTPS to api.vaara.ai (auth)
         → Vercel function → JWT → pool → SQL (~5 ms) → JSON
         → phone paints list
```

| Layer | Cost on 2G / weak 4G |
| --- | --- |
| Client debounce | Fixed **300 ms** before any request (`SchoolPicker`) |
| Auth’d GET | Every search needs `Authorization` → **cannot** sit on a public CDN the way PIN lookup does |
| Round trip | One full RTT per query (often 300–800 ms+ on 2G) |
| Overlapping requests | Typing `gau` fires `ga` then `gau` then `gaud…`; older responses are **not aborted** |
| Spinner | `searching` shows `ActivityIndicator` on every request → UI feels blocked |
| Nearby panel | Extra authenticated `GET /v1/schools/nearby` when the field is empty |

PIN lookup can be CDN-cached because it is **public**. School search is behind
`authMiddleware`, so **CDN does not apply** to the current endpoint without an
API design change.

---

## Current vs target (ASCII)

### Today

```
┌─────────────────────────────────────┐
│  Search by school name…             │
│  ┌─────────────────────────────┐    │
│  │ gau                     ▮   │    │
│  └─────────────────────────────┘    │
│           ○ Loading…                │  ← spinner every 300ms+RTT
│                                     │
│  (blank until response returns)     │
└─────────────────────────────────────┘
```

### Target

```
┌─────────────────────────────────────┐
│  Search by school name…             │
│  ┌─────────────────────────────┐    │
│  │ gau                     ▮   │    │
│  └─────────────────────────────┘    │
│  The Gaudium School · Kollur        │  ← instant from cache / local index
│  …                                  │
│  (network refresh silent if needed) │
└─────────────────────────────────────┘
```

---

## Redis vs CDN for schools

Same rule as PIN areas, different constraint:

```
PIN lookup:   Phone → CDN → (miss) API → Redis/DB     ✅ public GET
School search: Phone → API (JWT) → Redis/DB            ❌ no shared CDN today
```

| Option | Fit for school search | Notes |
| --- | --- | --- |
| **CDN** | Only if we add a **public** catalog endpoint (or signed/edge cache by query) | Today’s `/v1/schools/search` is auth-gated → CDN won’t help |
| **Redis (Upstash)** | **Best origin lever now** | Cache by normalized `q` + optional `pin`/`city`; TTL minutes–hours; invalidate on school create |
| **Client memory / disk** | Best **felt** speed | Cache last nearby list + recent search results; abort in-flight fetches |
| **Regional pack after PIN** | Best on 2G for onboarding | After location save, download ~PIN/city school list once; search locally while typing |

**Recommendation:** do **not** wait on CDN for school search. Use **Redis +
client caching**, and optionally a **compact regional school list** after Step 1
so typing does not hit the network on every keystroke.

---

## Full catalog preload (Redis + CDN)

**Yes — recommended at current scale.**

| Fact | Value (15 Sep 2026) |
| --- | --- |
| Rows | **216** schools |
| Slim list estimate | ~**30–80 KB** JSON (`id`, `name`, `branch`, `city`, `state`, `pin`, `verified`, boards) |
| Full table on disk | ~520 KB with indexes |

That fits easily in Redis and is a fine CDN object. Searching **in the app** (or at the
edge) against a preloaded list removes per-keystroke origin hits.

### What “preload all schools” means

```
Build slim catalog once
        │
        ├─► Redis   schools:catalog:v1          (origin L1, TTL hours–days)
        └─► CDN     GET /v1/reference/schools   (public, long s-maxage)
                        │
                        ▼
              App downloads once after login / after PIN
              (or on Step 2 mount)
                        │
                        ▼
              Typeahead filters locally — no search RTT
```

### Redis

- Key: `schools:catalog:v1` (or `…:v{gen}` when schools change)
- Value: slim JSON array (or gzip’d blob)
- Fill: on API boot / first miss / after seed or `POST /v1/schools`
- Invalidate: bump generation on create/update/hide school
- Optional: also keep `schools:by_pin:{pin}` slices for nearby, derived from the same catalog

Use Redis so **origin** never scans Postgres for every search. The phone still
needs one download unless we also use CDN + client disk cache.

### CDN

School search today is auth-gated → **CDN cannot cache `/v1/schools/search`**.

To CDN-preload the catalog:

1. Add a **public** (or at least CDN-friendly) endpoint, e.g.
   `GET /v1/reference/schools` → slim directory only (no parent PII).
2. Headers: `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`
3. Optional: `ETag` / `If-None-Match` so revisits are 304.
4. Mobile: fetch once, store in memory + AsyncStorage; filter locally in
   `SchoolPicker`. Refresh in background when stale.

Product note: this exposes the school **directory** without login. That matches
“schools are a shared reference list,” not private user data. Do **not** put
ratings tied to thin samples, internal keys, or creator user ids on the public
payload if those should stay gated.

### What stays off the public CDN blob

- Parent locations, children, membership
- Unverified create-in-progress junk (or include only `verified = true` + seeded)
- Heavy profile fields (fees, reviews) — keep those on auth’d detail routes

### How typing works after preload

| Step | Behavior |
| --- | --- |
| Open school step | Catalog already in memory (prefetch after location) or fetch once |
| Type `gau` | Local filter / prefix match — **0 network** |
| Pick school | Use cached `id` |
| “Add school” | Still `POST /v1/schools` (auth); then bump catalog gen |

## Why school search needs JWT today (and why it should not for signup)

| Endpoint | Auth today | Why |
| --- | --- | --- |
| `GET /v1/reference/postal-codes/...` | **None** | Reference data (PIN → city/areas). Same for every user. Safe to CDN. |
| `GET /v1/schools/search` | **JWT** | Mounted under `createSchoolsRoutes()` with `authMiddleware` on `*` — historical: schools live next to reviews, create, fees, etc. |

There is **no product reason** that *reading the school directory during
onboarding* must be logged-in. Postal lookup is the right model:

- School **names / branch / city / pin** are a shared directory, not private
  parent data.
- Signup already has a session after Google, but the **catalog fetch** should
  still be cacheable like location: public (or cookie-free) GET → CDN.
- What must stay auth’d: `POST /v1/schools` (create), reviews, fees, asking
  questions, anything tied to a user.

**Decision for onboarding:** treat school **directory read** like location —

```
GET /v1/reference/schools?...     → public, CDN + Redis  (directory)
POST /v1/schools                  → JWT                   (create)
GET  /v1/schools/:id/profile ...  → JWT as today          (rich / social)
```

`SchoolPicker` during signup should call the **reference** endpoint (or a pack
URL), not the auth’d search route. Same smoothness model as PIN → areas.

### Auth split (locked)

| Action | Auth | Rationale |
| --- | --- | --- |
| **Search / browse / pack download** (name, branch, city, pin, boards) | **Public** — same as postal lookup | Shared directory; must be CDN-cacheable; onboarding must not depend on JWT for typeahead |
| **Create school** | JWT | Writes to catalog; abuse control |
| **Reviews, fees, Q&A, events, compare write paths** | JWT | User-generated / social; not needed to pick a school at signup |

So: **normal searching should not require JWT.** Only mutate and social features stay behind auth.

Implementation sketch when we build it:

- Move or duplicate read-only search onto `/v1/reference/schools` (list/pack) and
  `/v1/reference/schools/search?q=` (national fallback).
- Strip `authMiddleware` from read-only GETs on `/v1/schools/search` and
  `/nearby` **or** leave those as deprecated auth’d aliases that proxy the same
  Redis/CDN-backed data (old app versions).
- Keep `authMiddleware` on `POST /v1/schools` and review/fee/question routes.

---

## Home PIN ≠ school PIN (pack design)

Parents often live in one PIN and school in another (same city, next suburb, or
a long commute). We **must not** assume `school.pin === home.pin`.

So “PIN-based pack” does **not** mean “only schools whose pin equals yours.”

### What the pack is for

After Step 1 we know **home** `pin` + `city` (+ locality). That answers:
“what should we **prefetch** so Step 2 feels instant?” — not “which schools
are allowed.”

### Pack composition (ordered)

```
1. Home PIN match          school.pin_code = home.pin
2. Home city match         school.city ≈ home.city   (Hyderabad, etc.)
3. Metro / region pack     e.g. west-hyderabad, if city pack still thin
4. Hard cap                e.g. 300 rows, verified/seeded first
```

Typing filters **that pack locally** first (fast path for the common case:
school near home).

### When school is elsewhere (near or far)

```
Local pack miss (typed name not in prefetch)
        │
        ▼
One national search (public reference or Redis-cached)
  GET /v1/reference/schools/search?q=gaudium
        │
        ├─ hit → show results (may be other PIN/city)
        └─ miss → “Add school”
```

Rules:

1. **Never hard-filter** search to home PIN only (that bug was already called
   out in `ONBOARDING_SIGNUP_REDESIGN.md` — school location and home location
   are independent).
2. Prefetch uses home PIN/city only as a **ranking / pack seed**, so nearby
   schools appear first with zero RTT.
3. Rank when showing national results: home PIN → home city → rest (same as
   today’s SQL `locationRank` intent).
4. Far school (other city) is fine: user types the name → national fallback →
   select. Slightly slower than local pack, still one request, not per keystroke
   once we add client caching of recent national hits.

### ASCII

```
Home: 502032 Tellapur
School could be:
  A) same PIN          → in pack, instant
  B) same city other PIN (Gachibowli) → usually in city/metro pack, instant
  C) other city        → pack miss → 1× national search by name
  D) not in DB         → Add school
```

**Do not** build packs as “PIN groups that define membership.” Circles already
handle school membership from the **chosen school id**, independent of home
PIN. Packs are only a **download shard for UX**.

---

## Scaling to ~10k schools (next few months)

**Full national preload on the phone will not stay smooth on 2G.**

Rough size if slim fields stay the same:

| Catalog | Slim JSON (approx) | gzip’d (approx) | Onboarding on 2G |
| --- | ---: | ---: | --- |
| 216 (today) | 30–80 KB | ~10–25 KB | OK to download whole list |
| **~10k** | **1.5–4 MB** | **~0.4–1 MB** | Risky — slow first paint, more drop-off |
| Redis holding 10k | Fine | Fine | Origin no problem |

So:

- **Redis:** yes, keep the **full** catalog (or shards) server-side.
- **CDN:** yes, but as **shards**, not one giant India file for every new parent.
- **Onboarding app download:** only the **pack for this parent’s PIN / city / metro** after Step 1 — not all 10k.

Onboarding does not need every school in India. After location, we already know
PIN + city. That is the unit of preload.

### Recommended architecture (works at 216 and at 10k)

```
Step 1: save PIN + area
        │
        ▼
Prefetch ONE regional pack (CDN + Redis behind it)
  GET /v1/reference/schools?pin=502032
  or  /v1/reference/schools?region=west-hyderabad
        │
        ├─ pin match
        ├─ same city / neighbouring pins (expand if thin)
        └─ cap ~200–500 rows (~50–150 KB raw, much less gzip’d)
        │
        ▼
Step 2: SchoolPicker
  - empty field → show pack “near you” instantly
  - typing → filter pack locally (0 RTT)
  - if no match → one server search (Redis-cached) OR “Add school”
```

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Full catalog │────►│ Redis           │────►│ CDN shards   │
│ ~10k in DB   │     │ catalog + packs │     │ per pin/region│
└──────────────┘     └─────────────────┘     └──────┬───────┘
                                                    │
                                            one download
                                                    ▼
                                            ┌──────────────┐
                                            │ Phone (pack) │
                                            │ local search │
                                            └──────────────┘
```

### Why this beats “download all 10k”

| Approach | Onboarding feel at 10k | Ops |
| --- | --- | --- |
| Full catalog to every phone | Slow/expensive on 2G; drop risk | Simple |
| **PIN/region pack after location** | **Fast & smooth** | Slightly more keys |
| Per-keystroke auth search only | Feels laggy (today’s pain) | Simple |
| Redis full catalog + CDN national file | Redis OK; CDN file too big for Step 2 | — |

### Pack rules (product)

1. **Primary:** schools with `pin_code = parent PIN`.
2. **If fewer than N (e.g. 15):** widen to same city, then neighbouring pins /
   metro pack (e.g. west Hyderabad).
3. **Hard cap** per download (e.g. 300) so 2G stays safe.
4. **Verified + seeded first**; user-created unverified can trail or stay
   server-only until trusted.
5. Typing with **no local hit:** one debounced `search?q=` (Redis query cache)
   across national catalog — rare path, not every keystroke.
6. **Add school** remains the escape hatch.

### Redis layout at 10k

| Key | Purpose |
| --- | --- |
| `schools:catalog:v{gen}` | Full slim list for API / pack builder |
| `schools:pack:pin:{pin}:v{gen}` | Precomputed onboarding pack |
| `schools:pack:region:{id}:v{gen}` | Metro fallback when pin pack is thin |
| `schools:search:v{gen}:{hash(q,pin,city)}` | Fallback typed search |

Build packs asynchronously on catalog change (or lazily on first request and
then CDN-cache).

### CDN layout at 10k

- `GET /v1/reference/schools?pin=502032` → public, long `s-maxage`
- Optional: `?region=west-hyderabad` for dense metros
- **Do not** require onboarding to fetch unfiltered `/reference/schools` once
  the catalog crosses ~1–2k rows

### Decision (updated)

| Question | At ~216 | At ~10k |
| --- | --- | --- |
| Full list in Redis? | Yes | **Yes** |
| Full list on CDN to phone? | Acceptable shortcut | **No** — use pin/region shards |
| Onboarding search | Local over pack (or full list while small) | **Local over PIN/region pack** |
| National typed search | Optional | Redis-cached fallback only |

**Primary goal:** zero per-keystroke network during onboarding school pick for
the common case (school is in the same PIN/metro pack).

---

## Agreed improvements (priority order)

### 1. Client: stop making search feel blocked (quick win)

Files: `apps/mobile/src/components/onboarding/SchoolPicker.tsx`, `apps/mobile/src/lib/api.ts`

- **Abort** previous search when a new query starts (`AbortController`).
- Keep showing **previous results** until new ones arrive (no full-panel spinner).
- Slightly longer debounce for 2-character queries (e.g. 300 → 400–450 ms);
  keep ~250–300 ms once `q.length >= 3`.
- In-memory map: `query → results` for the session so backspacing is instant.

### 2. Redis cache on `GET /v1/schools/search` (and nearby)

Files: `apps/api/src/routes/schools.ts`, `@vaara/redis`

- Key sketch: `schools:search:v1:{normQ}:{pin|−}:{city|−}:{sort}:{limit}`
- Value: JSON list already returned to the client
- TTL: e.g. **10–30 minutes** (catalog changes slowly)
- On `POST /v1/schools` (create): delete `schools:search:v1:*` or bump a
  `schools:search:gen` version counter in the key
- Same pattern for `nearby` keyed by pin/city

This cuts origin work after the first parent in a region searches “gaudium”.
It does **not** remove phone RTT by itself.

### 3. Prefetch after location (onboarding-specific)

When Step 1 saves PIN/city:

- Kick off `GET /v1/schools/nearby?pin=&city=` (or a dedicated compact list)
- Store in onboarding draft / AsyncStorage
- School step paints nearby **immediately** with no spinner

### 4. Optional: public slim catalog for CDN (later)

If we want CDN like PIN lookup:

- `GET /v1/reference/schools?pin=502032` — **no auth**, returns
  `{ id, name, branch, city, pin }` only
- `Cache-Control: public, max-age=300, s-maxage=86400`
- Client searches that list locally for onboarding; create-school still auth’d

Privacy: school directory rows are already discoverable to any logged-in parent;
a public pin-scoped list is an explicit product choice, not a DB leak of PII.

### 5. SQL hygiene (when catalog grows)

At 216 rows, seq scan is fine. Before ~5k+:

- Prefer prefix `ILIKE 'q%'` path first; use `%q%` / trigram as fallback
- Avoid `similarity(name || ' ' || branch, q)` in `ORDER BY` on large scans
  (computed expression defeats simple index use)
- Consider `SET pg_trgm.similarity_threshold` for short queries

Not the first fix for today’s “typing feels slow.”

---

## Target latency

| Path | Target |
| --- | --- |
| Repeat query in-session (client cache) | &lt; 16 ms to paint |
| Nearby after location prefetch | already on screen when Step 2 opens |
| Redis HIT at origin | origin &lt; ~20 ms + one RTT |
| Cold search | acceptable; warms Redis for the next parent |

---

## Out of scope

- Changing school create / verification rules
- Full nationwide on-device school dump in the app binary (use regional fetch)
- Making school optional for onboarding completion

---

## Success signal

- Time from keystroke (after debounce) to first painted results drops on 2G
- Nearby list on Step 2 appears without a blocking spinner after a normal
  location save
- Fewer “School not listed” creates that duplicate an existing seeded school
  (faster find → fewer false creates)
