# Onboarding location — locality UX

Decision doc for Step 1 (`/onboarding/location`). Supplements
`ONBOARDING_SIGNUP_REDESIGN.md`.

Related: school search speed (Step 2) —
[`ONBOARDING_SCHOOL_SEARCH.md`](./ONBOARDING_SCHOOL_SEARCH.md).

**Status:** agreed, not yet implemented.  
**Date:** 15 September 2026.

---

## Problem

Parents drop after Google signup with `created_at = updated_at` and no
`user_locations` row. They never leave the location screen.

Observed friction on the current UI:

1. **Continue is hidden** until PIN is valid *and* locality is non-empty. If
   the parent enters a PIN but does not tap a chip, there is no primary CTA —
   the screen can look broken or stuck.
2. **Locality chips are India Post office names** (e.g. `Admn. Bldgs`,
   `A.I.E. R.C.puram`), not how parents name their area (e.g. `Tellapur`).
3. **City and state are editable form fields** after lookup. They add noise;
   circle placement for locality uses **PIN**, not free-text city/state.
4. Multi-locality PINs (e.g. `502032` → 8 options) force a chip pick before
   Continue appears.

Child nickname / DOB are out of scope here. This doc is only about location
step clarity.

---

## Decision

### What the parent sees (Step 1)

Required:

- Country (default India)
- PIN / postal code
- **Area** — free-text field (primary). Parent types what they call the place
  (e.g. Tellapur). Chips are **optional shortcuts**, not a hard gate.

Not shown when PIN lookup succeeds:

- City
- State / region

Always show **Continue** (disabled with a one-line hint when area is empty).

### What the backend stores

On save (`PUT` / update location), always persist:

| Field | Source |
| --- | --- |
| `country_code` | Parent selection |
| `pin_code` | Parent entry |
| `locality` | Parent-typed or chip-selected area (required) |
| `city` | From postal lookup for that PIN (server-filled) |
| `state` | From postal lookup for that PIN (server-filled) |
| `community_name` | Optional; not collected on first-run Step 1 |

The client **does not need to send** city/state when lookup succeeded. The API
fills them from the same postal-code provider used by
`GET /v1/reference/postal-codes/:country/:code`.

If the client still sends city/state, the server may ignore them when a
successful lookup exists for that PIN, so the DB stays consistent with the
postal directory.

### When city / state *are* shown (and editable)

Only if postal lookup **fails** or is **unsupported** for the country:

- Show city + state fields
- Parent fills them manually
- Continue still requires area (locality)

---

## Target UI (ASCII)

### Lookup succeeds (normal India path)

```
┌─────────────────────────────────────┐
│  Step 1 of 3                        │
│                                     │
│  Where do you live?                 │
│  PIN finds nearby parents.          │
│                                     │
│  Country                            │
│  ┌─────────────────────────────┐    │
│  │ India                    ▾  │    │
│  └─────────────────────────────┘    │
│                                     │
│  PIN code                           │
│  ┌─────────────────────────────┐    │
│  │ 502032                      │    │
│  └─────────────────────────────┘    │
│                                     │
│  Medak · Telangana                  │  ← read-only summary from lookup
│                                     │  ← not editable fields
│                                     │
│  Your area *                        │
│  ┌─────────────────────────────┐    │
│  │ e.g. Tellapur               │    │  ← primary: free text
│  └─────────────────────────────┘    │
│                                     │
│  Nearby areas (tap to fill)         │
│  ┌──────────┐ ┌──────────┐          │
│  │ Tellapur │ │ Ameenpur │          │  ← suggestions; optional
│  └──────────┘ └──────────┘          │
│  More areas ▾                       │  ← bury noisy PO names
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Continue             │    │  ← always visible
│  └─────────────────────────────┘    │
│  Type or pick your area to go on.   │  ← only while area empty
└─────────────────────────────────────┘
```

### Lookup fails / unsupported country

```
┌─────────────────────────────────────┐
│  PIN                                │
│  ┌─────────────────────────────┐    │
│  │ …                           │    │
│  └─────────────────────────────┘    │
│  We couldn't look up this PIN.      │
│  Enter your area and city below.    │
│                                     │
│  Your area *   [ ................ ] │
│  City *        [ ................ ] │  ← shown only on failure
│  State         [ ................ ] │
│                                     │
│  [ Continue ]                       │
└─────────────────────────────────────┘
```

---

## Product rules

1. **Text-first locality.** Chips fill the text field; they do not replace it.
2. **Continue always visible.** Disabled until area has non-empty trimmed text
   (and PIN is valid). Never hide the button.
3. **No city/state editing on the happy path.** Show a single read-only line
   (`{city} · {state}`) after successful lookup for reassurance only.
4. **Server fills city/state from PIN.** Client may omit them on save when
   lookup succeeded.
5. **Suggestion ranking (follow-up).** Prefer parent-language / high-usage
   locality names; fold cryptic India Post labels under “More areas”. Exact
   ranking algorithm can land in a later change; UX does not depend on it.
6. **Circle model unchanged.** Locality circle key remains PIN-based
   (`PIN_{code}`). Free-text `locality` is display / matching context, not a
   new circle type.

---

## API notes (implementation)

Current write path: `apps/api/src/routes/me.ts` location update inserts
`locality`, `city`, `state` from the request body.

Intended behavior after this change:

1. Validate country + postal code.
2. Attempt `lookupPostalCode(client, country, pin)`.
3. If lookup hits:
   - `city` / `state` ← lookup result (authoritative)
   - `locality` ← required from body (trimmed)
4. If lookup misses:
   - require `locality` and `city` from body; `state` optional
5. Response still returns the stored row (including server-filled city/state)
   so the school step can seed nearby search with city + PIN.

Mobile (`apps/mobile/app/onboarding/location.tsx`):

- Stop rendering editable City / State when `lookupSupported` and lookup OK.
- Keep locality text field always available once PIN is ready.
- Always render Continue; disable when `!canContinue`.
- On save, send country + PIN + locality; omit city/state on success path
  (or send them and let the server overwrite — either is fine if documented
  in the route).

---

## Speed: area suggestions on slow networks (2G)

Goal: after the 6th PIN digit, area suggestions should feel **instant** even
on 2G. The bottleneck on 2G is almost always **RTT to the phone**, not
Postgres CPU.

### What we have today

| Layer | Behavior |
| --- | --- |
| Endpoint | `GET /v1/reference/postal-codes/:country/:code` (public, no auth) |
| Origin | DB cache of offices → else `api.postalpincode.in` → else bundled `@twin.techies/india-pincode` |
| Edge | Already `Cache-Control: public, max-age=3600, s-maxage=86400`. Production shows `x-vercel-cache: HIT` for warm PINs |
| Payload | ~900 B for `502032` (full locality objects + empty `communities`) |
| Client | Debounce 350 ms, then network lookup before chips appear |

So **CDN is already leveraged** for popular PINs. A cache HIT still costs one
mobile RTT (~300–800 ms on 2G, often worse). Redis at the origin does **not**
remove that RTT.

### Redis vs CDN — which helps what

```
Phone ──RTT──► CDN edge ──(miss)──► API origin ──► Redis / Postgres / postal API
                 ▲
                 └── HIT: no origin, but phone still paid the RTT
```

| Option | Helps | Does not help |
| --- | --- | --- |
| **CDN (Vercel)** | Repeat / popular PIN lookups; zero origin cost; already working | First request on a cold PIN from a phone still waits on network |
| **Redis (Upstash, ap-south-1)** | Origin cold path after CDN miss; faster than Postgres + external postal API; good for write-through after first lookup | Phone→edge latency on 2G; first paint if every user still hits the network |
| **Slim response** | Less transfer on 2G (~200 B names-only vs ~900 B today) | RTT (headers still round-trip) |
| **On-device India PIN pack** | **True instant chips on 2G** (0 network for suggestions) | Non-IN countries; keeping the pack fresh |

**Recommendation (in order):**

1. **CDN first (keep + tighten)** — public GET is the right shape. Prefer a
   **slim** suggestion payload so HIT responses are tiny. Optionally raise
   `s-maxage` (PIN→areas rarely change).
2. **Redis as origin L1** — key `postal:IN:{pin}` → JSON `{city,state,areas[]}`.
   Fill on miss from current lookup pipeline; TTL days/weeks. Cuts CDN-miss
   origin time; does not replace CDN.
3. **On-device for India (best 2G UX)** — ship a compact PIN→`{city,state,areas}`
   map (or reuse the same dataset the API already bundles). Show suggestions
   **synchronously** when the 6th digit is typed; optionally refresh from CDN
   in the background. Save path still hits the API (server fills city/state).

Do **not** put Redis in front of the phone. Redis belongs behind the API for
origin acceleration. CDN belongs in front of the API for shared GETs.

### Suggested response shape for chips (CDN + Redis friendly)

```json
{
  "countryCode": "IN",
  "postalCode": "502032",
  "city": "Medak",
  "state": "Telangana",
  "areas": ["Tellapur", "Ameenpur", "Ramachandrapuram"]
}
```

Omit per-office metadata and empty `communities` from the hot path. Community
suggestions can load later or only on settings edit.

### Target latency

| Path | Target after PIN complete |
| --- | --- |
| India, on-device hit | &lt; 50 ms to show chips (no network) |
| CDN HIT (slim) | one RTT + ~200 B |
| CDN miss + Redis HIT | one RTT + origin &lt; ~30 ms |
| Cold (postal API) | rare; acceptable if Redis/CDN warm afterward |

---

## Out of scope

- Changing onboarding step order (location → school → class)
- Community / apartment field on first-run Step 1 (already deferred)
- Making child optional for `onboarding_complete` (separate discussion)
- School picker loading / nearby suggestions

---

## Success signal

Fewer accounts stuck with Google signup only (`onboarding_complete = false`,
no `user_locations` row) within the same day of install, without reducing
quality of PIN → locality circle placement.

Secondary: time from 6th PIN digit → first area chip visible stays under
~100 ms on device for India when the on-device pack is present; network path
remains acceptable on 2G via slim CDN responses.
