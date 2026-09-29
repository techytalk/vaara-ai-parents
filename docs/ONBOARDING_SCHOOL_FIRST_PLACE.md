# Onboarding — school, then board, then where you live

**Status:** specified, not built.  
**Date:** 29 September 2026.

Replaces the PIN-first location step when this ships. Until then, production
stays location → school → board. Geo capture in
[ONBOARDING_LOCATION_GEO_OBSERVATION.md](./ONBOARDING_LOCATION_GEO_OBSERVATION.md)
stays as it is.

Parents type a hometown PIN because the first question is a PIN box. Ask for
the school first, then the board, then **where they live now**. They search a
place (area or apartment). We store a canonical area, country, city, optional
PIN, and the apartment name when Google returns one.

## Locked decisions

- New order: school → board/grade or preschool age → where you live → Ready.
- School/board/age remain draft-only until finalization.
- One transactional finalization endpoint writes location + child + circles.
- Google Places is primary; the post-office catalogue is fallback.
- Nearby identity is `area_id`, not exact PIN.
- Apartment/community remains separate from area.
- Country is part of canonical area identity.
- Coordinates are not needed or stored.
- The normal onboarding path does **not** call an LLM.
- Unknown/ambiguous area resolution is asynchronous and fully automatic; there
  is no manual admin approval step.
- An uncertain background result stays separate rather than risking a wrong
  merge.

---

## Screen order

**School-age**

1. `/onboarding/school` — search the campus. Each row shows name, branch, and city (`DPS · Nacharam · Hyderabad`). No PIN ranking yet.
2. `/onboarding/class` — board and grade. Unchanged choices. Continue saves the selection to the onboarding draft only; it does **not** create the child.
3. `/onboarding/location` — “Where do you live now?” Continue sends the complete location + child draft to one finalization endpoint.
4. `/onboarding/ready`

**Preschool**

1. School (track = Preschool 3–4)
2. `/onboarding/age` — 3 or 4. No PIN in the copy. Continue saves the age to the onboarding draft only; it does **not** create the child.
3. Location — finalize location and preschool child in one request.
4. Ready

Back from class goes to school. Back from age goes to school. Back from location goes to class or age. New signups land on school, not location (`routeNewParentOnboarding` in [apps/mobile/src/lib/auth-navigation.ts](../apps/mobile/src/lib/auth-navigation.ts)).

No child or location exists in the database before finalization. School, track,
board/grade, preschool age, and the chosen place stay in the persisted
onboarding draft. `POST /v1/me/onboarding/finalize` writes location and child in
one database transaction, runs `syncCircleMembership`, marks onboarding
complete, and returns the complete user, child, and circle list.

```text
School -> board/grade or age -> choose place
                                      |
                                      v
                          finalize in one transaction
                         (location + child + circles)
                                      |
                                      v
                           complete circle list -> Ready
```

---

## Location screen

Header: **Where you live now.**  
Headline: **Where do you live now?**

One search field. Results as they type. No 6-digit PIN field.

| They type | What we show |
| --- | --- |
| `gachi` | `Gachibowli, Hyderabad` |
| `My Home Bhooja` | `My Home Bhooja · Gachibowli, Hyderabad` |
| `500032` | Areas on that PIN (same list as today), so a parent who only knows the number is not stuck |

Empty apartment search:

> No area matches “My Home Bhooja”. Type the area you live in. Example: Gachibowli, Kondapur.

That empty state is only when **both** Google and the post-office list miss. A Google hit for the building must not fall through to this.

Several PINs for one area collapse to **one row** (`Kondapur, Hyderabad`). They do not pick a PIN.

After a result is tapped, show one compact confirmation before Continue:

```text
My Home Bhooja
Gachibowli, Hyderabad, Telangana 500032

[Change]                                      [Continue]
```

If Google identifies the apartment but does not return a usable area, show a
second **Choose your area** search. Do not guess from coordinates.

### City differs from the school

Only after they pick a place whose city is not the school city:

> Your school is in Hyderabad. Nearby parents use where you live now.

Copy and actions are dynamic from the school city: **Use an area in
{schoolCity}** (clear the pick, keep search) and **My child lives in
{selectedCity}** (keep the pick). No “Are you in Hyderabad?” question. Treat
configured metro aliases such as Hyderabad/Secunderabad as the same city; do
not infer the city match from PIN alone.

First session after Ready is still tour and messages. No extra location banner there.

---

## Canonical area and `area_id`

`area_id` means the stable **nearby locality** parents recognize: Gachibowli,
Kondapur, Miyapur. It is not a city, district, mandal, apartment, PIN, or map
coordinate.

Add an `areas` catalogue:

```text
areas
  id                  UUID
  country_code        IN
  canonical_name      Gachibowli
  city                Hyderabad
  state               Telangana
  normalized_key      IN|hyderabad|gachibowli (unique)

area_aliases
  area_id
  alias               Gachibowli Village

area_postal_codes
  area_id
  postal_code         500032
```

`user_locations.area_id` references `areas.id`. The selected building remains
`community_name`; it does not become the area. The country is part of the
identity, so the same locality name in another city or country is a different
area.

Google can suggest a new area not yet in the catalogue. On confirmation, the
API finds it by normalized country + city + area, checks aliases, or creates
the provisional area row. Do not create an area row for every apartment.

Area lifecycle:

```text
active                canonical area used directly
pending_resolution    provisional area; background resolver has not decided
redirected            alias/duplicate; canonical_area_id points to active area
```

Add `canonical_area_id` (nullable self-reference) and `status` to `areas`.
Resolution always follows redirects to the active root. Record every automated
merge in `area_merge_events` with inputs, model result, confidence, and previous
IDs so an incorrect automated merge is auditable and reversible.

### Fast deterministic resolver

Run this synchronously; expected database work is under 100 ms:

1. Known Google area source ID → active `area_id`.
2. Exact canonical key within country + city.
3. Exact `area_aliases` match within country + city.
4. Safe normalized match.
5. Otherwise create/reuse `pending_resolution` area and enqueue background
   resolution.

Safe normalization includes case, punctuation, whitespace, and an approved
country-specific suffix list (`Village`, `Vlg.`). It must not remove meaningful
tokens such as East/West, Phase, Sector, Extension, Nagar, or Colony.

Examples:

```text
GACHIBOWLI             -> Gachibowli
Gachibowli Village     -> Gachibowli (safe suffix / learned alias)
Financial District     -> separate from Gachibowli
Kondapur Phase 2       -> do not silently collapse into Kondapur
```

---

## What one chosen place saves

Sent with the complete draft to `POST /v1/me/onboarding/finalize`. Do not store
keystrokes or the suggestion list.

| Piece | Column | Example |
| --- | --- | --- |
| Canonical area | `user_locations.area_id`, `locality` | area UUID, Gachibowli |
| Country / city / state | `country_code`, `city`, `state` | IN, Hyderabad, Telangana |
| PIN | `pin_code` | `500032` when the selected Google address supplies it; otherwise nullable/reference-only |
| Apartment, only if the place is a building | `community_name`, `community_key` | My Home Bhooja |

Typing an area with no building leaves `community_name` empty.

If Google returns the building and a postal code, use that PIN. If it returns
the building but no postal code, keep the PIN nullable or resolve it only when
the area has exactly one unambiguous postal code. Do not pick an arbitrary
Head Office PIN.

If Google returns a building but no usable area component, ask the parent to
choose the area in a second area search. Do not guess a nearest area.

School city sorts suggestions. It does not choose the place. The school campus PIN is not copied onto the home address.

---

## Atomic finalization, failure, and resume

Location Continue makes one request:

`POST /v1/me/onboarding/finalize`

The payload contains:

- `onboardingAttemptId`
- school and track
- curriculum + grade, or preschool age
- country, canonical area candidate, city, state, optional PIN
- optional apartment/community

```text
BEGIN
  reserve/check the onboarding idempotency key
  resolve or create canonical area
  upsert user_locations
  insert child
  sync circle membership
  mark onboarding complete
  store the idempotent response
COMMIT
```

If validation or any write fails, roll back the complete transaction. There is
never a location-without-child or child-without-location state from this flow.

Keep the full draft until the request succeeds. Disable the button while
finalizing. If the request times out, retry with the **same**
`onboardingAttemptId`; the endpoint returns the stored response rather than
creating a duplicate.

Resume rules:

```text
no child + complete draft including chosen place -> location, ready to retry
no child + draft missing place                  -> location search
no child + partial school/class-or-age draft    -> first incomplete step
child + location                                -> Ready or app
```

Do **not** use `kids.length > 0 -> Ready` without also checking location.

Ready receives circles from finalization. As a defensive consistency check, it
may render that response immediately and re-fetch `/circles`.

---

## Search implementation

**Primary: Google Places**, called from the API so the key is not in the app.

- `GET /v1/reference/places?q=&city=&sessionToken=` — autocomplete, biased to
  the school city already chosen but not restricted to it.
- `POST /v1/reference/places/resolve` — accepts place ID + Places session token,
  loads Place Details on the server, parses premise/building, area/sublocality,
  city, state, country, and postal code, and returns display data plus a
  short-lived Vaara `placeSelectionToken`.
- Coordinates are not needed for this flow, are not requested for area assignment, and are not stored.
- Env: `GOOGLE_PLACES_API_KEY` on the API. Enable Places API (Autocomplete + Place Details) and billing. Send a session token from the app for one search-and-pick so Google bills it as one session.

The finalization endpoint accepts the opaque `placeSelectionToken`, not
client-supplied area/city/PIN strings. The token is signed or backed by a
short-lived server/Redis record (about 15 minutes) containing the parsed place.
This prevents a modified client from creating arbitrary canonical areas.

For postal fallback, issue the same kind of Vaara selection token after the
parent chooses an area row.

Search protections:

- debounce around 250–350 ms;
- minimum 2–3 characters (or six digits for PIN);
- cancel stale requests;
- per-user/IP rate limit;
- country-aware result types;
- short cache for safe autocomplete/fallback results, subject to Google Places
  storage and attribution terms;
- timeout/error state that keeps postal fallback usable.

**Fallback: post offices we already have** (`postal_code_offices`).

- New query by `office_name` (today’s lookup is only `country + postal_code` in [apps/api/src/lib/postal-code/providers/storage.ts](../apps/api/src/lib/postal-code/providers/storage.ts)).
- Clean the office suffix (`SO` / `BO`) the way PIN lookup already does.
- Group by country + cleaned name + city. Return all known postal codes as area metadata; do not select an arbitrary preferred PIN.
- School city first in the sort.

Merge the two lists. If the same area appears in both, show it once. A building from Google wins over a post-office row with the same words.

---

## Address parsing

Google can return premise, neighborhood, several sublocality levels, locality,
district, state, and country. Store the raw provider component labels needed
for audit, but use a country-specific parser to choose the user-facing area.

For India, fixtures must cover marketed Hyderabad addresses. Prefer a
recognizable neighborhood/sublocality; city is separate. District/mandal is
never automatically used as the nearby area. If no component is confidently an
area, ask the parent to choose one.

Parsed result:

```text
premise/community    My Home Bhooja
area                 Gachibowli
city                 Hyderabad
district             Rangareddy (optional metadata, not a circle)
state                Telangana
country              IN
postal code          500032 (optional/reference)
```

The selected apartment Google place ID may be stored as a provider source for
community deduplication if permitted by Google policy. It is not the
`area_id`. A provider area source ID, when available for the area itself, maps
to `area_sources(area_id, provider, provider_place_id)`.

---

## Background LLM area resolution

LLM resolution is outside the onboarding request and runs only for
`pending_resolution` areas. Known canonical names and aliases never call the
model.

```text
finalization commits provisional area
             |
             v
area_resolution_jobs row (source of truth)
             |
             v
worker retrieves candidates in same country + city
             |
             v
LLM returns match | distinct | uncertain as structured JSON
             |
        +----+----+
        |         |
high-confidence  uncertain/distinct
auto-match       keep provisional area
        |
        v
save alias + redirect + reconcile users/circles/content
```

There is no manual admin approval. The job table/outbox is committed with
finalization so a Redis enqueue failure cannot lose the work. The worker or
maintenance sweep retries pending jobs.

### Model

Primary: **Google Gemini 2.5 Flash through Vercel AI Gateway**.

- temperature `0`;
- structured JSON schema;
- approximately 150–250 maximum output tokens;
- input limited to raw area, country/city/state, postal metadata, provider
  types, and 5–10 candidates from the same city;
- never send parent, child, school, email, apartment, or full street address.

If the model/provider fails, retry later. No synchronous fallback model is
needed. An optional provider fallback such as OpenAI GPT-4.1 mini may be used
only after repeated worker failures; uncertainty still means “keep separate.”

### Automatic merge guard

Auto-match only when:

- same country and city;
- model confidence ≥ `0.97`;
- deterministic text/alias similarity also supports the result;
- no conflicting direction, phase, sector, extension, or numbered token;
- postal metadata is compatible when available;
- winner has a clear margin over the second candidate.

Otherwise keep the provisional area. Do not repeatedly call the LLM for the
same unchanged evidence. When an alias is learned, future onboarding resolves
without an LLM call.

### Reconciliation

An accepted match:

1. adds `area_aliases` / provider source mapping;
2. marks provisional area `redirected` to canonical area;
3. updates `user_locations.area_id` through the canonical root;
4. re-syncs memberships;
5. merges/moves area-circle membership and content;
6. records `area_merge_events`.

---

## Nearby circle

Today [apps/api/src/services/circle-sync.ts](../apps/api/src/services/circle-sync.ts) creates `PIN_{pin}` with display `{pin} · {locality}`.

After this, the nearby circle is the area:

- Key: `AREA_{area_id}` (stable UUID-backed area identity)
- Display name: `Gachibowli, Hyderabad`
- Metadata includes `area_id`, `country_code`, canonical locality, and city.

Kondapur `500084` and Kondapur `500032` are **one** circle. `Indiranagar, Hyderabad` and `Indiranagar, Bengaluru` stay two.

Apartment circle is unchanged: `community_key` from `community_name`.

**Existing members.** Do not leave old parents in `PIN_*` while new parents
join `AREA_*`. Backfill `area_id` from current locality/city/country using the
same deterministic/provisional resolver, then move memberships.

Because current PIN circles can contain several localities, migrate historical
content by root author area:

- channel message → author’s resolved area;
- thread root → root author’s resolved area, with all replies kept together;
- memberships/reads follow the resulting target circle;
- archive the old PIN circle after validation.

Run a dry report and backup first. Since existing PIN-locality message volume is
low, this is a one-time migration rather than a permanent alias layer.

Age-locality circles (`addAgeLocalityCircles`) use the same area key, not the PIN.

---

## Replace PIN proximity across the product

PIN remains optional/reference address data. `area_id` becomes the source of
truth for proximity.

| Surface | Change |
| --- | --- |
| Feed / timeline discovery | viewer `area_id` = author `area_id` |
| Locality and age-locality circles | keys and metadata use `area_id` |
| Listings | copy `area_id` at creation so old listings do not move with user |
| Carpool | copy/match `area_id` together with school |
| Playdates | store/match `area_id` for area scope |
| Activities | replace activity PIN mapping with activity areas |
| Providers | replace service PIN list with provider service areas |
| Chat/discovery access | compare `area_id`, not exact PIN |
| Schools | school PIN remains school address data; school identity stays school ID |
| Apartment/community | continue using `community_key`, scoped under area where needed |

Transition safely:

1. add nullable `area_id` columns and dual-write;
2. backfill existing rows;
3. prefer area matching, with PIN fallback only for legacy null rows;
4. migrate existing circles/content;
5. make required columns/indexes;
6. remove PIN fallback after validation.

---

## Unlisted-school flow

Existing schools continue to come from Vaara’s school database. Rows always
show school name + branch/locality + city so duplicate campus names are clear.

The existing **Can’t find your school?** form stays:

- school name and city required;
- branch, state, and PIN optional;
- no location defaults during new onboarding because home location is later;
- duplicate-candidate confirmation remains unchanged.

---

## Performance, privacy, and observability

Onboarding never waits for an LLM. Target from tapping a resolved place to
Ready: p95 under 2 seconds, excluding unusually slow client networks.

Track:

- Places autocomplete/details latency and error;
- postal fallback usage;
- deterministic match / alias / provisional rate;
- finalization latency and idempotent retries;
- background LLM queue age, result, confidence, cost, and merge count;
- reconciliation failures;
- number of active/provisional/redirected areas.

Do not put apartment, complete address, Google place ID, `area_id`, or raw
search text in GA4. Existing `onboarding_geo` may send city, state, country,
source (`places|postal|pin`), and booleans for community/provisional area.

---

## Rollout

1. Add area schema, resolver, Place APIs, finalization endpoint, job/outbox, and
   dual-read/dual-write backend support.
2. Pre-seed marketed Hyderabad canonical areas and generate common alias
   candidates offline; apply only aliases that pass deterministic guards.
3. Dry-run existing user/PIN-circle migration and record counts.
4. Release mobile behind a remote feature flag: school-first + place search.
5. Monitor search/finalization/provisional rates.
6. Backfill all product `area_id` columns and migrate PIN circles/content.
7. Switch proximity reads from PIN fallback to area-only after validation.
8. Expand parser fixtures and canonical areas before opening a new country.

Old clients remain supported during dual-read/dual-write. Do not make
`user_locations.area_id` mandatory until the supported old runtime has aged
out or been forced to update.

---

## Acceptance tests

- School-age and preschool complete through the new order.
- Closing/reopening at every step resumes at the first incomplete step.
- Repeated finalization with the same attempt ID creates one child/location.
- Forced failure inside finalization leaves neither child nor location.
- Ready shows complete, freshly synchronized circles.
- Apartment result saves community + canonical area; area result leaves
  community empty.
- Building with no area requires area selection; no coordinate guess.
- Several PINs map to one area; same locality name in another city/country does
  not collide.
- Known alias resolves without an LLM call.
- Unknown area completes immediately and creates one durable resolution job.
- LLM outage does not affect onboarding.
- High-confidence guarded match reconciles automatically; uncertain match
  stays separate.
- Existing PIN circle migration preserves message/thread/read counts.
- Feed, listing, playdate, carpool, provider, activity, and chat access tests
  use `area_id`.
- Old client remains functional during the dual-read phase.

---

## Files

| Area | Files |
| --- | --- |
| Order, back, first screen | [apps/mobile/src/lib/auth-navigation.ts](../apps/mobile/src/lib/auth-navigation.ts), [apps/mobile/app/onboarding/school.tsx](../apps/mobile/app/onboarding/school.tsx), [class.tsx](../apps/mobile/app/onboarding/class.tsx), [age.tsx](../apps/mobile/app/onboarding/age.tsx), [location.tsx](../apps/mobile/app/onboarding/location.tsx), [\_layout.tsx](../apps/mobile/app/onboarding/_layout.tsx) |
| Place search and finalization UI | [apps/mobile/app/onboarding/location.tsx](../apps/mobile/app/onboarding/location.tsx) — replace the PIN field and the “current PIN” headline; submit one finalization request with the complete draft. Profile edit of location uses the same search and the existing location-update route. |
| School rows without a PIN | [apps/mobile/src/components/onboarding/SchoolPicker.tsx](../apps/mobile/src/components/onboarding/SchoolPicker.tsx) — branch and city always visible. The existing unlisted-school form stays: school name and city required; branch/state/PIN optional. It receives no location defaults during new onboarding. |
| Draft-only class/age | [apps/mobile/app/onboarding/class.tsx](../apps/mobile/app/onboarding/class.tsx) and [age.tsx](../apps/mobile/app/onboarding/age.tsx) — remove child creation from Continue; persist draft and navigate to location. |
| API | New place routes beside [apps/api/src/routes/reference.ts](../apps/api/src/routes/reference.ts). Area search over `postal_code_offices`. Add transactional `POST /v1/me/onboarding/finalize` in [apps/api/src/routes/me.ts](../apps/api/src/routes/me.ts). Keep the existing location and child routes for profile/child edits. |
| Database | Add `areas`, `area_aliases`, `area_sources`, `area_postal_codes`, `area_resolution_jobs`, `area_merge_events`, and `user_locations.area_id`; include country in canonical identity. Add/backfill `area_id` on local-feature tables. |
| Circles | [apps/api/src/services/circle-sync.ts](../apps/api/src/services/circle-sync.ts) |
| Proximity queries | Feed/timeline, listings, carpool, playdates, activities, providers, and chat-access services that currently compare `pin_code`. |
| Worker / LLM | [apps/worker/src/index.ts](../apps/worker/src/index.ts) plus an area-resolution service in the API package; Vercel AI Gateway credentials in worker env. |
| Analytics | Keep `onboarding_geo`. Add `source=places\|postal\|pin` and whether `community` was set. No place id in GA4. |

Draft step order in [apps/mobile/src/lib/onboarding-draft.ts](../apps/mobile/src/lib/onboarding-draft.ts) becomes `school | class | age | location | ready`.

---

## Not in this change

- GPS permission, or filling the field from the device.
- A Hyderabad yes/no gate.
- Mandal or district as the circle.
- Storing Google’s suggestion list, or lat/lng, on the user.
- Return-visit mismatch banner (still later).

---

## Remaining decisions before implementation

1. **Area granularity fixtures:** confirm expected canonical outcomes for
   Gachibowli, Gachibowli Village, Financial District, Nanakramguda, Rai Durg,
   Kondapur phases, KPHB, and other marketed locations. This is the main
   product decision; an LLM cannot define community boundaries for us.
2. **Google project:** provision Places API key/billing, set server
   restrictions/quotas, and verify current Places attribution/storage terms.
3. **Legacy migration report:** measure active members/messages/threads per PIN
   circle and approve the generated root-author routing before the migration.
4. **International rollout:** India parser and fixtures ship first; each new
   country needs its own component/suffix fixtures even though country already
   participates in area identity.
5. **Automatic merge rollback:** choose retention period for merge evidence and
   an operational command to reverse a bad automated merge. No manual approval
   is required, but rollback must exist.
