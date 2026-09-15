# Onboarding discovery — consolidated implementation plan

One coordinated build scope covering Step 1 (location), Step 2 (school), and the
child-identity fields that sit around them (§8). Supersedes the sequencing in
[`ONBOARDING_LOCATION_LOCALITY.md`](./ONBOARDING_LOCATION_LOCALITY.md)
and [`ONBOARDING_SCHOOL_SEARCH.md`](./ONBOARDING_SCHOOL_SEARCH.md), which remain
the reference for UX detail and cache reasoning.

Onboarding asks for four things: **PIN, area, school, class.** Nothing else.

**Status:** decisions agreed; one coordinated implementation, with ordered
activation and validation gates.
**Date:** 15 September 2026.

---

## What the data changed

Three measurements moved the design away from PIN-sharded packs.

| Finding | Value | Consequence |
| --- | --- | --- |
| `branch` holds locality | 214 / 215 rows, 20 distinct values | Locality exists already. No geocoding needed. |
| City / PIN are unusable as-is | 5 rows have a PIN; 210 say `Hyderabad`; PIN `502032` resolves to `Medak` | Never shard on `city` or `pin_code`. |
| Duplicates split circles | 5 of 6 Gaudium parents in `502032` joined a user-created `Gaudium` row, not seeded `The Gaudium School · Kollur` | Highest-value fix. Caching does not touch it. |

The product damage is **circle fragmentation**, not latency. Slow search causes
it: a parent who cannot find the school in a few seconds creates a duplicate.

---

## Design in one line

Open Step 2 with a **short list the parent can tap** — ranked by what parents in
their PIN actually chose — and treat typed search as the fallback, not the
primary interaction.

```
Step 1  PIN + area  ──save──►  server resolves city/state + locality
                                        │
                        prefetch (public, CDN): shortlist + catalogue
                                        │
Step 2  shortlist shown instantly  ──► tap to select        (common case)
                    │
                    └── typing ──► local catalogue filter   (0 RTT)
                                        │
                                        └── no match ──► "did you mean" ──► Add school
```

---

## 1. Data layer

Land this first. Everything else depends on it.

### 1.1 Schema

```sql
ALTER TABLE schools
  ADD COLUMN locality   text,          -- canonical, normalised from branch
  ADD COLUMN region     text,          -- metro grouping, e.g. west-hyderabad
  ADD COLUMN aliases    text[] NOT NULL DEFAULT '{}';
```

- `locality` — normalise `branch` (trim, title case, alias map: `Osman Nagar` →
  `Osman Nagar`, `Hyderbad` → `Hyderabad`, `Madhapur / HITEC City` → `Madhapur`).
- `region` — coarse grouping for fallback when a locality is thin.
- `aliases` — `Gaudium`, `Gaudium School`, `TGS` → `The Gaudium School`. This is
  what stops duplicate creation.
- `verified` already exists and is the **only school status**. Do not add a
  second `published` flag. Vaara-uploaded schools are inserted with
  `verified = true`; parent-created schools remain `false` until the daily
  admin review. Only verified schools enter public search and the catalogue.
- An unverified school is visible to its creator and can be used for that
  parent's enrollment immediately. Every authenticated school read uses the
  common predicate `verified OR created_by_user_id = current_user`; public
  routes use `verified = true` only.

### 1.2 Search document + index

One generated column, one index, instead of the current three-way `ILIKE` plus
`similarity()` sort.

```sql
ALTER TABLE schools
  ADD COLUMN search_text text
  GENERATED ALWAYS AS (
    lower(coalesce(name,'') || ' ' || coalesce(branch,'') || ' ' ||
          coalesce(locality,'') || ' ' || array_to_string(aliases, ' '))
  ) STORED;

CREATE INDEX idx_schools_search_trgm ON schools USING GIN (search_text gin_trgm_ops);
CREATE INDEX idx_schools_locality    ON schools (locality) WHERE verified;
CREATE INDEX idx_schools_region      ON schools (region)   WHERE verified;
```

Drop `city ILIKE` from the search predicate. Rank with a prefix bucket, then
similarity — do not compute `similarity()` over an unfiltered scan.

### 1.3 Backfill and merge

1. Populate `locality` / `region` from `branch` via an explicit alias map.
2. Do **not** infer a canonical school PIN directly from parents' home PINs.
   Home and school may be far apart. If the signal is retained for operations,
   store it as inferred metadata with sample size and confidence; never
   overwrite a verified address automatically.
3. Generate duplicate candidates, but do not auto-merge them. School names and
   campuses are ambiguous enough that a human must choose the survivor.

### 1.4 Admin duplicate-resolution panel — required, separate work surface

The onboarding build needs safe merge primitives. The admin UI can be delivered
in the same project, but parents never see it.

For every proposed duplicate cluster (`Gaudium` → `The Gaudium School`), show:

- both schools' name, branch, locality, city, aliases, verification status,
  creator and parent count;
- every dependent row count: enrollments, reviews, fee reports, questions,
  events, listings, carpool offers/arrangements;
- `SCHOOL_*` and `SCHOOL_CLASS_*` circles, their members, posts, post targets,
  shares and timeline/outbox/cache impact;
- conflicts that cannot be merged automatically, such as one parent's two
  reviews becoming duplicates under a uniqueness constraint;
- a dry-run preview: survivor, aliases added, parents moved, circles redirected,
  conflicts and expected row counts.

Admin actions:

1. **Not duplicates** — dismiss the candidate and record the decision so it is
   not suggested again.
2. **Merge** — choose the survivor and conflict policy, then enqueue the merge.
3. **Needs investigation** — leave both rows unchanged with an admin note.

The merge job must be resumable and auditable. Write a merge ledger containing
source school, survivor, reviewer, conflict decisions, before/after row counts,
affected circle IDs, status and timestamps. Repoint every school foreign key,
resync affected parents, migrate both school and school-class circle content,
invalidate affected feed/timeline caches, and keep the source as a tombstone
with `redirect_to_school_id`. Do not hard-delete it.

Parents are not manually reassigned one by one: when the admin confirms a true
duplicate, their enrollment references move to the survivor and their circle
membership is resynchronised. The dry-run tells the admin exactly which parents
and content will move before approval.

---

## 2. Stop new duplicates

In `POST /v1/schools`, before insert:

1. Fuzzy-match `search_text` against the submitted name plus city/locality.
2. Strong match → return the existing row (200), do not insert.
3. Weak matches → return candidates so the client can show
   **"Did you mean?"** before allowing a create.
4. Genuine new school → insert with `verified = false`, usable immediately by
   the creator, promoted after review.
5. Rate-limit creates per user.

The client must show the candidate list before the create button. Most
duplicates come from the UI offering "Not here / Other" too eagerly.

### 2.1 Backward compatibility and OTA

The new mobile candidate UI is JavaScript-only and can be sent through the
existing Expo production OTA channel (`runtimeVersion = 1.0.3`). Publish to
preview first, verify, then publish to production.

OTA does **not** guarantee that every installed app has the update immediately:
it checks on app load, `fallbackToCacheTimeout = 0` means the current launch may
continue with the embedded bundle, and builds on another runtime do not receive
the update. Therefore the API cannot switch all clients to a mandatory `409`
response immediately.

Use an explicit client capability such as
`X-Vaara-School-Dedupe: candidates-v1`:

- capable client + weak match → `409` with typed candidates;
- old/no capability client → retain the compatible behavior during the
  transition and log the attempted duplicate;
- after OTA/store adoption reaches the agreed threshold, enforce candidate
  confirmation for all supported versions.

School creation also accepts an idempotency key so retries cannot create two
rows concurrently.

### 2.2 Daily school moderation

Parent-created schools enter an admin queue with `verified = false`.
Each day, an admin:

1. matches it to an existing school and merges/redirects it; or
2. corrects name, branch, locality, city, state, PIN and aliases, then verifies
   it; or
3. leaves it pending with a reason if evidence is insufficient.

Verification is the publication action: setting `verified = true` includes the
school in public search and the next catalogue generation. Record reviewer and
review timestamp in the audit log. Until then only its creator can see it.

---

## 3. Privacy-safe shortlist

The ranking signal already exists: `children.school_id` joined to
`user_locations.pin_code`.

```sql
-- materialised, refreshed daily; not computed per request
CREATE MATERIALIZED VIEW school_pin_affinity AS
SELECT ul.country_code,
       ul.pin_code,
       c.school_id,
       COUNT(DISTINCT c.user_id) AS parents
FROM children c
JOIN user_locations ul ON ul.user_id = c.user_id
JOIN schools s        ON s.id = c.school_id
WHERE s.normalized_key <> 'school_not_specified||unknown'
  AND s.verified = true
GROUP BY 1, 2, 3
HAVING COUNT(DISTINCT c.user_id) >= 5;
```

Never expose or derive a parent-based entry from fewer than five distinct
parents for that school and country/PIN. Publish only ordering, never counts,
refresh no more than daily, and monitor repeated PIN enumeration.

Shortlist tiers, in order:

1. **Dense PIN:** verified schools with at least five distinct selecting parents
   in that exact country/PIN, ordered by bucketed affinity.
2. **Sparse/new PIN:** do not use exact-PIN parent behavior. Show verified
   schools popular across the broader region, again only where each school has
   at least five parents in the aggregate.
3. **No safe crowd signal:** show a stable directory shortlist — verified
   schools matched to the normalized locality/region, then admin-curated
   featured schools and alphabetical order. This contains no parent behavior.
4. Cap the combined result at about 30 rows.

This means the shortlist still works on day one and in low-density PINs; it is
less personalized, but does not leak attendance. Typed local/global catalogue
search is always available. Home PIN influences convenience, never eligibility.

---

## 4. Public reference API

Read is public and CDN-cacheable. Write and social stay authenticated.

| Route | Auth | Cache |
| --- | --- | --- |
| `GET /v1/reference/schools/manifest` | public | `s-maxage=60` |
| `GET /v1/reference/schools/catalog/v{gen}` | public | immutable, 1 year |
| `GET /v1/reference/schools/shortlist?country=&pin=` | public | `s-maxage=3600` |
| `GET /v1/reference/schools/search?q=` | public | `s-maxage=600`, rate-limited |
| `POST /v1/schools` | JWT | none |
| reviews / fees / questions / profile | JWT | unchanged |

Guardrails on the public routes:

- Minimum 3 characters before fuzzy search; normalise and length-cap `q`.
- Cap results (e.g. 20) and expose verified directory fields only.
- Apply separate limits by route cost; catalogue/manifest, postal lookup,
  shortlist and fuzzy search must not consume one shared quota.
- Remove `communities` from the postal response — it is user-derived data
  currently frozen into a 24-hour public CDN object. Move it behind auth.

Keep `/v1/schools/search` and `/nearby` as authenticated aliases so existing
app versions keep working.

---

## 5. Catalogue delivery

One compressed, versioned artifact — not per-PIN packs.

- Keep the existing school UUID unchanged. Do not add short IDs or an ID
  translation layer.
- Slim row: `{ id, name, branch, locality, region, aliases, boards }` (or one
  pre-normalized `searchTokens` value instead of raw aliases). Branch/campus and
  aliases are required for useful local search and duplicate prevention.
- Re-measure compressed size using the final row shape; the earlier
  120–200 KB estimate omitted these required fields.
- `manifest` (short TTL) points at an **immutable** `catalog/v{gen}` URL.
  Bump `gen` when verification, name, branch, locality, region, aliases, boards,
  merge redirects or unpublishing changes searchable data. Never wildcard-delete.
- Client stores the artifact on disk, checks the manifest on a cadence, and
  refreshes in the background.

The manifest includes schema version, generation, checksum, compressed size and
creation time. Download to a temporary file, verify checksum, then atomically
replace the active catalogue. Keep the previous generation for rollback and
delete older generations after successful activation.

This removes pack building, pack invalidation, and per-PIN cache cardinality.

Redis is **not** on the onboarding read path. Use it only for the hot
`search?q=` cache and a build lock, with a short timeout and fall-through to
Postgres — the shared client currently allows a 5 s connect timeout, which is
worse than the ~5 ms query it would be protecting.

---

## 6. Location step (Step 1)

- Continue **always visible**, disabled with a one-line reason.
- Area is a **text field first**; suggestions are chips that fill it.
- City and state are a **read-only line** (`Medak · Telangana`), shown as
  fields only when lookup fails.
- Do not clear a typed area when the chip list changes.
- `PATCH /v1/me/location` performs the postal lookup server-side and writes
  authoritative `city` / `state`; `locality` required from the body.
- On save, fire the shortlist and catalogue prefetch without blocking navigation.

### 6.1 Persist the onboarding draft

`apps/mobile/src/lib/onboarding-draft.ts` currently stores everything in module
memory. Replace it with a small versioned persisted draft using the already
installed `expo-secure-store`.

Persist country, PIN, locality, selected school UUID, curriculum UUID, grade
UUID, current step, catalogue generation and a generated onboarding-attempt ID.
Do not persist whole catalogue payloads in SecureStore. Restore the parent to
the last valid step after app restart, expire abandoned drafts after seven days,
and clear the draft only after the ready screen has completed successfully.

---

## 7. School step (Step 2)

- Open with the **shortlist**, already prefetched. No spinner.
- 1–2 characters: filter the local catalogue only.
- 3+ characters: local results immediately, plus one debounced public search
  merged in by id when it arrives.
- **Abort** superseded requests and keep prior results visible — today neither
  happens, so a response for `gau` can overwrite `gaud`.
- "Not here / Other" appears only after search settles, and routes through the
  "did you mean" candidates.

### 7.1 Idempotent final enrollment

Generate one UUID `onboardingAttemptId` when the draft begins and persist it
through every step. Send it as `Idempotency-Key` when `class.tsx` calls
`POST /v1/me/children`.

The API reserves `(user_id, route, idempotency_key)` transactionally and stores
the completed response. Repeating the same key returns the original child,
circles and user response without inserting another enrollment. A different
key remains valid, so twins in the same school/class are still supported; do
not enforce a unique constraint on `(user_id, school_id, curriculum_id,
grade_id)`.

### 7.2 Compact onboarding chrome (Steps 1–3)

**Decided.** The interactive controls are fine; the vertical stack **above** them
is too tall. On school especially, Continue sits below the fold once the
keyboard is open. Fix density on location, school and class in the same build —
this is layout and copy, not architecture.

#### What is wrong today

`OnboardingPayoff` plus a second form title appear on every step. School is the
worst case:

1. Step label  
2. Large icon hero (`56px` circle + overlapping secondary icon)  
3. Payoff title at `fontSize 24`  
4. Supporting body  
5. A **second** title at `fontSize 20` (“Where does your child go to school?”)  
6. Then the search field (`paddingVertical: 14`)

Two titles say roughly the same thing. Location and class use the same pattern.

The search / PIN / board inputs themselves are normal. Chip and grade tap
targets must stay finger-friendly — do **not** shrink those aggressively.

#### Target layout

```
BEFORE                              AFTER
Step 2 of 3                         Step 2 of 3
[ big icons ]                       Pick your child's school
Long title + long body              Search… / shortlist already visible
Form title again                    Continue (above the fold)
Search box
Continue (often below fold)
```

#### Required changes

| Surface | Change |
| --- | --- |
| `OnboardingPayoff` | Add a compact mode (or drop icons on Steps 1–3). One short title; optional one-line body. No second form title underneath. |
| `app/onboarding/location.tsx` | One title; city/state as a read-only line; Continue always visible without scrolling past padding theatre. |
| `app/onboarding/school.tsx` | One title; shortlist / search as the first interactive content; Continue visible with the keyboard closed on a typical phone. |
| `app/onboarding/class.tsx` | Same chrome rules; board and class chips keep current tap size. |
| Field chrome | Field `paddingVertical` `14` → `10–12`; tighten section gaps. Keep input text at about `16px`. |
| Copy | Titles fit on one line where possible. Cut duplicated payoff / form-title pairs. |

#### Acceptance

- With the keyboard closed on a common phone viewport (~667–812 pt tall), Step 2
  shows step label, one title, the school field / shortlist, and Continue
  without scrolling.
- No screen stacks `OnboardingPayoff` title and a second `formTitle` saying the
  same thing.
- Board / class chips remain easy to tap; no reduction below ~40 pt height.

---

## 8. Child identity

**Decided.** Signup asks for nothing about the child as a person. Nickname and
date of birth are written `NULL`; gender remains `"unspecified"`. None of these
fields appear in the four-step flow. They stay available, optional, on the
post-signup **Add a child** and **Edit child** screens, so the data is there if
a later feature wants it.

Onboarding asks for exactly four things: **PIN, area, school, class.**

### 8.0 Why the child row still exists

`children` carries `school_id`, `curriculum_id` and `grade_id`. The row is not a
profile of a child — it is **one enrollment**: this parent has a kid at this
school, on this board, in this class. That is why it is a table and not columns
on `users`: a parent with two kids at two schools needs two rows, and circles
are built per enrollment.

So `evaluateOnboardingComplete` requiring "a location row plus a child row" is
already identical to requiring "location + school + class".

**The completion gate does not change.** Do not touch
`evaluateOnboardingComplete` or `lib/auth-navigation.ts`.

### 8.1 Evidence

Two checks drove the decisions below. Re-run them before building if the data
has moved.

**`date_of_birth` and `gender` have no consumer.** Grepping
`apps/api/src` for either name returns hits in `routes/me.ts` only — the
`INSERT`, the `PATCH` field list, and `CHILD_SELECT`. No circle assignment, feed
ranking, playdate matching or notification reads them. They are write-only
columns.

**Null identity is already the norm.** From Supabase on 15 Sep 2026:

```sql
select count(*)                                      as child_rows,
       count(*) filter (where nickname is null)      as nickname_null,
       count(*) filter (where date_of_birth is null) as dob_null,
       count(*) filter (where school_id is not null
                          and curriculum_id is not null
                          and grade_id is not null)  as has_school_class
from children;
```

| child_rows | nickname_null | dob_null | has_school_class |
| --- | --- | --- | --- |
| 29 | 6 | 24 | 29 |

Every row has school, board and class. Most have no date of birth. The
`"Not set"` and `"Child"` fallbacks in §8.4 are therefore the *default* view,
not an edge case.

### 8.2 Already correct — do not touch

| Surface | Why it is already fine |
| --- | --- |
| `children.nickname`, `children.date_of_birth` | Nullable in the schema |
| `POST /v1/me/children` | Treats nickname, DOB and gender as optional; writes `NULL` when absent; defaults gender to `"unspecified"` |
| `app/onboarding/class.tsx` | The final signup step sends only `schoolId`, `curriculumId`, `gradeId`, `gender: "unspecified"` |
| `components/onboarding/ChildFormFields.tsx` | Used **only** by `children/add.tsx` and `children/edit/[id].tsx` — neither is in the signup flow |
| `children/add.tsx`, `children/edit/[id].tsx` | Both already pass `identityOptional` and `schoolFirst`, so identity fields render last and read "Optional — never shown to other parents" |
| DB columns | Keep. 5 rows hold a date of birth; older app builds still send these fields |
| API contract | Keep the request and response fields so older builds keep working |

Signup is `location → school → class → ready`. `children/add.tsx` is reached
only from the children list or a completion prompt, which are both post-signup.
That is exactly the behaviour we want, and it is already shipped.

The one cosmetic leftover: `identityOptional` defaults to `false`, which renders
`"Nickname *"` and `"Date of birth *"`. No caller uses the default. Flip it to
`true` so the required-looking labels cannot reappear by accident.

### 8.3 Remove the nickname tour step

`app/tour/child.tsx` and step 3 of `components/tour/HomeTourOverlay.tsx` exist
only to capture nickname and DOB. They fire in the parent's first session, when
they have one child and no reason to name them.

There are two implementations in the repository, but only one is active.

Repository-wide reference search confirms that
`components/tour/HomeTourOverlay.tsx` is mounted by `app/(app)/index.tsx`.
Nothing outside `app/tour/` navigates into `/tour/circles`; the route-based tour
is orphaned. **Keep the overlay as the canonical tour and delete the unused
route screens after a deep-link smoke test.**

#### Dead route tour — remove

Delete `app/tour/_layout.tsx`, `circles.tsx`, `ask.tsx` and `child.tsx`. Keep
`components/tour/TourFrame.tsx` for now because `onboarding/ready.tsx` imports
`circleTypeIcon` from it; after deleting the route screens, extract that helper
to a neutral module and remove the unused `TourFrame`/`TourHero` components.

#### Overlay tour — `components/tour/HomeTourOverlay.tsx`

1. Dots array `[1, 2, 3]` → `[1, 2]`.
2. Step 2's "Later" button calls `setStep(3)`; change it to
   `finish(true, "ask")`.
3. Delete the `step === 3` block, `onSaveNickname`, the `nickname` /
   `dateOfBirth` state, and the `childDobBounds` import.
4. `stepKey` is `step === 1 ? "circles" : step === 2 ? "ask" : "child"` — drop
   the `"child"` arm.
5. Remove the `api.getChildren` fetch that exists only to populate the nickname
   field. This also removes a network call from home-screen mount.

#### Regression to avoid

`tour_completed` currently fires **only** inside `finish(completed = true)`,
which today is reached from the step-3 paths. `onAsk` completes the tour without
firing it. Once step 3 is gone, verify `tour_completed` still fires on every
terminal path — "Later", "Skip", and "Ask your first question" — or the funnel
silently reports zero completions.

Finally, retire `child_identity_saved` from the `AnalyticsEvent` union in
`lib/analytics.ts` once both call sites are gone.

### 8.4 Display: act where they can act, label where they cannot

A null nickname is the normal case (§8.1), so `"Child"`, `"Your child"` and
`"Not set"` are what most parents see today. All three are dead ends.

The replacement depends on what the position is **for**. A CTA belongs where the
parent can act on it; a chip or a section heading needs an identifier.

#### Where the parent can act — offer "Add a nickname"

| File | Today | Change to |
| --- | --- | --- |
| `app/onboarding/children/[id].tsx` | `Nickname` row value `"Not set"` | Tappable row reading **Add a nickname**, linking to the edit screen focused on the field |
| `app/onboarding/children/[id].tsx` | Date-of-birth row `"Not set"` | Tappable **Add date of birth** |
| `app/onboarding/children/index.tsx` | Card title `nickname \|\| "Child"` | Title becomes the identifier below, plus a secondary **+ Add nickname** link on the card |

Both detail rows stay on the screen. Now that nothing else asks for these
fields, those rows are the only way a parent discovers they exist.

```
BEFORE — child detail                AFTER — child detail
┌────────────────────────────┐       ┌────────────────────────────┐
│ Child details              │       │ CBSE · Grade 4             │
│ ────────────────────────── │       │ The Gaudium School         │
│ Nickname        Not set    │       │ ────────────────────────── │
│ Date of birth   Not set    │       │ Nickname     Add a nickname│ ← tappable
│ Board           CBSE       │       │ Birthday     Add date…     │ ← tappable
│ Class           Grade 4    │       │ Board        CBSE          │
│ School          Gaudium    │       │ Class        Grade 4       │
└────────────────────────────┘       │ School       Gaudium       │
                                     └────────────────────────────┘
```

#### Where the label is only an identifier — use board · grade

| File | Today | Change to |
| --- | --- | --- |
| `app/onboarding/children/index.tsx` | Card title `nickname \|\| "Child"` | `CBSE · Grade 4` |
| `app/onboarding/children/index.tsx` | Avatar initial from nickname, else `"C"` | Initial from school name |
| `app/onboarding/children/index.tsx` | `accessibilityLabel` `Edit ${nickname \|\| "child"} profile` | Same board · grade string |
| `app/onboarding/children/[id].tsx` | Screen title `nickname \|\| "Child details"` | `CBSE · Grade 4` |
| `app/(app)/playdates.tsx` | Chip `nickname \|\| "Child"` | `child.grade.label` |
| `lib/circle-groups.ts` | Group label `nickname?.trim() \|\| "Your child"` | Board · grade |

In every position, **where a nickname is set, keep showing it** — it is the
better label. Board · grade is the fallback, not a replacement.

The privacy line in `children/[id].tsx` ("never this nickname, date of birth, or
school name") stays accurate — those fields still exist, they are just optional.
No edit needed.

#### Twins — the one case where a nickname is load-bearing

Two children at the same school in the same class render identical board · grade
labels. Disambiguate in this order: school, then creation order. When two rows
still collide, **promote** the "+ Add nickname" link on the children list from
secondary to primary, so it appears exactly when the parent feels the confusion
— rather than asking everyone up front.

### 8.5 Completion prompts

Prompt slots are scarce. `completion-prompts.ts` applies a 7-day then 30-day
backoff and retires a key permanently after the third dismissal. Spending a slot
on a field with no consumer costs the slot for `missing_school`, which actually
unlocks the school circle.

In `lib/completion-prompts.ts`:

1. Remove `"missing_nickname"` from the `CompletionPromptKind` union.
2. Remove it from `KIND_PRIORITY`.
3. Delete the `for (const child of children)` loop that pushes the
   `missing_nickname` candidate.
4. In `hrefForCompletionPrompt`, drop `missing_nickname` from the
   `case "missing_school": case "missing_nickname":` pair, and delete the
   `prompt.kind === "missing_nickname" ? { focus: "identity" } : {}` spread — a
   `missing_school` prompt should never open on the identity fields.
5. `missing_school` builds its CTA as `Add school for ${nickname || "your
   child"}`. Change it to board · grade.

Keep `missing_school`, `missing_area`, `missing_community` and
`add_another_child` exactly as they are.

**Do not remove `focus` from the edit route.** Step 4 above deletes the *prompt's*
use of it, but `children/edit/[id].tsx` still reads `focus` for
`schoolFirst={focus !== "identity"}`, and the new "Add a nickname" row in §8.4 is
what links to it now. The param survives; only the prompt stops using it.

### 8.6 API

Two fixes. `PATCH /v1/me/children/:id` rejects an empty nickname:

```
if (!nick) return c.json({ error: "nickname cannot be empty" }, 400);
```

A parent who sets a nickname cannot clear it. Allow an empty string or explicit
`null` to write `NULL`. Apply the same rule to date of birth; today an empty DOB
also returns `400`, so **Add date of birth** would be irreversible.

Everything else on the API stays: keep `nickname`, `gender` and `dateOfBirth` in
the `POST` and `PATCH` bodies, keep them in `CHILD_SELECT` and the response
shape, and keep the columns. Older app builds still send them, and 5 rows hold a
date of birth.

### 8.7 Acceptance checklist

- A new parent completes signup having typed only a PIN, an area, a school and a
  class. No nickname, DOB or gender field appears at any point.
- The row written by `class.tsx` has `nickname IS NULL`,
  `date_of_birth IS NULL`, `gender = 'unspecified'`, and non-null
  `school_id` / `curriculum_id` / `grade_id`.
- The first-session tour is two steps, and `tour_completed` fires from all three
  exits (Later, Skip, Ask).
- No child-identity surface renders `"Child"` / `"Your child"` as the null
  nickname fallback, or `"Not set"` for the actionable nickname/DOB rows.
- The children list, detail title, playdates chip and circle group label all
  read board · grade for a null nickname, and the nickname when one is set.
- Tapping **Add a nickname** on the detail screen opens the edit screen with the
  identity fields first.
- Adding a second child still offers optional nickname and DOB, last in the
  form, under the "optional and stay private" subtitle.
- A parent can clear a previously-set nickname without a 400.
- A parent can clear a previously-set date of birth without a 400.

### 8.8 Existing users

No data migration and no backfill. Three carry-over cases, all benign:

- **Parents who already set a nickname or DOB** (23 rows have a nickname, 5 have
  a DOB) keep them, and every surface still shows the nickname in preference to
  board · grade.
- **Stale `missing_nickname` dismissal keys** sit in SecureStore under
  `vaara_completion_prompt_dismissals`, keyed by string. Once the kind is gone
  from `KIND_PRIORITY` the entries are simply never looked up. Leave them; a
  cleanup pass is not worth a release.
- **Parents mid-tour** who already completed it are gated by
  `hasCompletedAppTour`, so shortening the tour cannot re-trigger it. Parents who
  skipped it stay skipped.

Older app builds continue to POST nickname, DOB and gender. §8.6 keeps the API
accepting them, so no forced upgrade is required.

---

## 9. Instrumentation

Add timing and source to existing events, so the next campaign produces real
numbers:

- `location_screen_view`, `pin_lookup` (`source`, `ms`, `error`), `area_selected`
  (`chip` vs `typed`)
- `shortlist_ready` (`ms`, `size`), `shortlist_tapped` (`rank`)
- `school_query` (`ms`, `source`: `local` / `remote`, `results`)
- `school_selected` (`source`), `school_create_shown_candidates`,
  `school_created`
- Abandonment: screen view without completion

Server: log the postal lookup source (DB / external / bundled) and search
duration.

---

## One coordinated implementation, ordered activation

The product work is approved as one project and should be implemented together.
That does **not** mean activating destructive database merges, new API
enforcement and mobile behavior in one irreversible deployment. OTA adoption is
not immediate, and a school merge cannot be undone by rolling back application
code. Use these gates inside the same implementation effort:

| # | Work | Gate |
| --- | --- | --- |
| 1 | Additive schema: locality, region, aliases, redirect/audit fields; define `verified` backfill; search index | none |
| 2 | Admin duplicate queue, dry-run merge engine and ledger; do not execute merges | after 1 |
| 3 | Public reference routes, visibility predicate, per-route rate limits, slim postal response | after 1 |
| 4 | Catalogue artifact/manifest, UUID rows, checksum and rollback generation | after 3 |
| 5 | Privacy-safe affinity and directory fallback; shadow refresh only | after 1 |
| 6 | Server-authoritative location save, persisted draft and idempotency API | parallel |
| 7 | Mobile client: location UX, shortlist-first picker, local search, abort; compact chrome (§7.2); candidate capability | after 3–6 |
| 8 | Child identity: canonical overlay tour, prompt, display and clear behavior (§8.3–8.6) | parallel |
| 9 | Instrumentation, operational metrics and admin audit reporting | parallel |
| 10 | Preview OTA, old-client contract tests, 10k/2G/offline/corruption tests | after 7–9 |
| 11 | Production OTA/store rollout; observe capability adoption | after 10 |
| 12 | Enforce candidate confirmation for supported clients | after 11 threshold |
| 13 | Admin-approved duplicate merges in small batches; verify circles/content/cache invariants after each | after 12 |

This is still one implementation scope. The ordering is a safety mechanism, not
a proposal to postpone features to an unspecified later project.

---

## Success criteria

- Step 2 paints a usable shortlist with no spinner and no typing.
- Typing produces results without a network round trip in the common case.
- New school creates fall sharply; no new duplicate of a seeded school.
- Same-day signup → location completion rate rises from the current pattern
  where most Google signups never write a `user_locations` row.
- Onboarding asks for four things only: PIN, area, school, class.
- Steps 1–3 use one title each (no payoff + form-title double stack); Step 2
  shows Continue above the fold with the keyboard closed.
