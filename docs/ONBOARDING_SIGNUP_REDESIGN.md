# Onboarding & Sign-up Redesign

This document is the specification for streamlining the parent sign-up and
onboarding flow. It supplements `UI_UX_REDESIGN.md` and
`BUSINESS_FUNCTIONALITY.md`. It does not change Vaara's privacy rules, its
membership model, or the way circles are derived.

## Why this change

Marketing traffic reaches the app and drops off during onboarding. A new parent
currently passes through roughly nine screens and more than a dozen fields
before seeing a single post. Three of those screens ask for information that is
private, unused for circle placement, or collectable later.

The sample size behind the observed drop-off is small (single-digit installs at
the time of writing), so this redesign is driven by removing demonstrable
friction rather than by statistically significant funnel data. Instrumentation
is part of the scope precisely so the next campaign produces real numbers.

## Current flow (as-is)

### Screen sequence

| # | Route | Screen | Required input |
| --- | --- | --- | --- |
| 1 | `/(intro)` | `IntroScreen` scene 0 | none — **Get Started advances the carousel** |
| 2 | `/(intro)` | scenes 1–4 | none, Skip available from scene 1 |
| 3 | `/(auth)/register` | `RegisterScreen` | role, email, password |
| 4 | `/onboarding/children` | `ChildrenListScreen` | blocked until ≥1 child |
| 5 | `/onboarding/children/add` | `AddChildScreen` | nickname, DOB, school, curriculum, class |
| 5a | — | `SchoolPicker` create form | school name, branch, city |
| 6 | `/onboarding/location` | `LocationScreen` | country, PIN |
| 7 | `/(app)` | home | — |

### Gating rules

`evaluateOnboardingComplete` requires both a child row and a location row:

```215:226:apps/api/src/services/circle-sync.ts
export async function evaluateOnboardingComplete(
  client: PoolClient,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM children WHERE user_id = $1) AS has_children,
       EXISTS (SELECT 1 FROM user_locations WHERE user_id = $1) AS has_location`,
    [userId]
  );
  return rows[0]?.has_children && rows[0]?.has_location;
}
```

The check is order-agnostic, which is what makes the reordering below possible
without touching the gate.

## Diagnosis

### 1. The primary call to action does not do what it says

On intro scene 0, **Get Started** advances to the next marketing slide. A user
who taps the primary CTA after clicking an ad receives another pitch instead of
a sign-up form. This is treated here as a defect, not a design preference.

### 2. Location is collected after school, defeating an existing feature

`SchoolPicker` passes the parent's city and PIN into school search, sourced from
`api.getLocation()`. On first run that call returns nothing, because location is
step 6 and school is step 5. Every new parent therefore searches with no
locality signal at all.

### 3. School search filters on location instead of ranking by it

Worse than a missing signal, the parameters are a hard filter:

```125:129:apps/api/src/routes/schools.ts
           AND (
             ($4::text IS NULL AND $5::text IS NULL)
             OR city ILIKE $4
             OR pin_code = $5
           )
```

Once a PIN or city is supplied, a school is excluded unless it matches one of
them. A parent living in one city whose child studies in another would search
the exact correct name and receive zero results, then be pushed into creating a
duplicate of a school that already exists. School location and parent location
are independent facts; only the parent's PIN drives locality circles.

The ordering clause already handles location correctly, as a tie-breaker:

```106:108:apps/api/src/routes/schools.ts
             rating_count DESC, rank_bucket, sm DESC, name`
          : `rank_bucket, sm DESC,
             CASE WHEN pin_code = $5 THEN 0 ELSE 1 END, name`;
```

### 4. Private child details block sign-up but do not place the child

Nickname and date of birth are required by the API, are explicitly never shown
to other parents, and are not used by `syncCircleMembership`. They are pure
friction at the point of sign-up.

### 5. Curriculum and class are pre-filled

`pickDefaultCurriculum` selects CBSE and the first grade is auto-selected. A
parent who taps through lands in "CBSE / Grade 1" circles silently. A
wrongly-placed parent is worse than a lost one: they see irrelevant content,
churn anyway, and degrade the circle for everyone already in it.

### 6. The funnel is unmeasured exactly where it matters

`trackOnboardingBegin()` fires `tutorial_begin` on the children list screen —
after account creation. Between app open and sign-up there is no per-screen
event, so the region where drop-off is suspected is the least instrumented.

## Decisions

| Decision | Outcome | Rationale |
| --- | --- | --- |
| School selection | **Mandatory** | School is the product's anchor. Without it, `school` and `school_class` circles are never created, so the parent gets the weakest version of the product. |
| Nickname, date of birth | **Deferred to in-app** | Private, unused for placement, already nullable in the database. |
| Curriculum, class | **Mandatory, no default** | A silent mis-placement is worse than an extra tap. |
| Intro carousel | **Deleted** as a blocking flow | Its content moves to a small swipeable strip on the auth screens. Install base is small enough that no back-compat path is needed. |
| "Use my location" | **Not in v1** | See below. |
| Setup screen count | **Three light screens** | Perceived effort tracks fields and typing per screen, not screen count. |
| Community name, extra children | **Deferred to in-app** | Optional data with no bearing on first-session value. |

### Why "Use my location" is excluded

`expo-location` is not currently a dependency. Its `reverseGeocodeAsync` does
return a `postalCode`, so a coordinate-to-PIN path is technically possible
entirely on the client — the existing `lookupPostalCode` helper only resolves
PIN to locality, not the reverse. Three reasons to leave it out of v1:

1. It triggers an OS location permission dialog on the very first onboarding
   screen, shown to a privacy-sensitive audience that has not yet seen any
   value from the app.
2. Reverse-geocoded postal codes are inconsistent in India, particularly on
   Android where the platform geocoder frequently returns a neighbouring code
   or none at all. An auto-filled wrong PIN reproduces the exact failure mode
   we are removing from the curriculum default: silently wrong placement.
3. The manual alternative is six digits.

It can be revisited later as a secondary link with an explicit confirm step.

## Value model: what the three questions unlock

`syncCircleMembership` derives **five** circles from PIN, school, board and
class for a single child:

| Circle type | Key | Display | Requires |
| --- | --- | --- | --- |
| `curriculum` | `CURR_<code>` | "CBSE Parents" | board |
| `class` | `CLASS_<code>_<grade>` | "CBSE · Grade 5" | board + class |
| `school` | `SCHOOL_<key>` | "DPS · Whitefield · Bengaluru" | school |
| `school_class` | `SCHOOL_CLASS_<key>_<code>_<grade>` | "DPS · Whitefield · CBSE · Grade 5" | school + board + class |
| `locality` | `PIN_<pin>` | "560034 · Koramangala" | PIN |

A sixth `community` circle is created only when a community name is supplied,
which is why that field moves out of onboarding.

Note the distinction the copy must respect: `class` is every parent on that
board and grade nationwide, while `school_class` is the parents of the child's
actual classmates. `school_class` exists only for a real school:

```85:88:apps/api/src/services/circle-sync.ts
    if (
      child.school_normalized_key &&
      child.school_normalized_key !== PLACEHOLDER_SCHOOL_KEY
    ) {
```

This is the concrete reason school stays mandatory: it is the difference
between four circles and two.

## Target flow

```
LAUNCH
  |
  v
+------------------------------------------+
|  SIGN UP                                  |
|  "Parents from the same school,           |
|   class and locality."                    |
|                                           |
|  [ Continue with Apple  ]                 |
|  [ Continue with Google ]                 |
|  [ Use email instead ]                    |
|                                           |
|  Already have an account? Log in          |
|  I'm a teacher or school                  |
|                                           |
|  . . . swipeable pitch strip . . .        |
+--------------------+----------------------+
                     |
                     v
+----------------------------+  +----------------------------+  +----------------------------+
|  1 of 3                    |  |  2 of 3                    |  |  3 of 3                    |
|                            |  |                            |  |                            |
|  Where do you live?        |  |  Where does your child      |  |  Board and class           |
|                            |  |  go to school?             |  |                            |
|  PIN  [ 560034         ]   |  |                            |  |  Board                     |
|                            |  |  [ search by name...     ] |  |  ( CBSE ) ( IB ) ( ICSE )  |
|  Koramangala, Bengaluru    |  |   > Delhi Public School     |  |  ( IGCSE ) ( State )       |
|                            |  |     Whitefield, Bengaluru  |  |  -> Connect with CBSE      |
|  Meet parents in your      |  |   > DPS North               |  |     parents across India   |
|  neighbourhood.            |  |     Hebbal, Bengaluru      |  |                            |
|                            |  |                            |  |  Class                     |
|  Only your area is used,   |  |  Connect with every parent  |  |  ( Nursery )( LKG )( 1 )   |
|  never your address.       |  |  at your child's school     |  |  ( 2 )( 3 )( 4 )( 5 )...   |
|                            |  |  and branch.               |  |  -> Get into the circle of |
|  [ Continue ]              |  |                            |  |     your child's class     |
|                            |  |  Can't find your school?    |  |     parents at DPS         |
|                            |  |                            |  |     Whitefield             |
|                            |  |  [ Continue ]              |  |                            |
|                            |  |                            |  |  [ Enter Vaara ]           |
+----------------------------+  +----------------------------+  +----------------------------+
        tap / 6 digits                typing, needs focus           two taps, no typing
                     |
                     v
+------------------------------------------+
|          You're in 5 circles              |
|                                           |
|   *  DPS Whitefield · CBSE · Grade 5      |
|   *  DPS Whitefield                       |
|   *  CBSE · Grade 5                       |
|   *  CBSE Parents                         |
|   *  560034 · Koramangala                 |
|                                           |
|          [ Start exploring ]              |
+--------------------+----------------------+
                     |
                     v
                  HOME
```

Screens are split by input type: the one typing task stands alone, and the
tapping tasks are grouped. Board and class share a screen because they are a
dependent pair — the class list is derived from the board, so the parent should
watch the options change in place rather than commit blind.

### Microcopy

Verbs are deliberately varied so the three screens do not read as one repeated
sentence.

| Screen | Heading | Value line | Supporting |
| --- | --- | --- | --- |
| 1 | Where do you live? | Meet parents in your neighbourhood. | Only your area is used, never your address. |
| 2 | Where does your child go to school? | Connect with every parent at your child's school and branch. | Can't find your school? |
| 3 board | Board and class | Connect with `<BOARD>` parents across India. | rendered after selection |
| 3 class | — | Get into the circle of your child's class parents at `<SCHOOL>`. | school name is known by this point |
| Payoff | You're in `<N>` circles | — | Start exploring |

The board and class value lines are rendered dynamically from the selections
already made, so the promise is concrete rather than generic.

## Change list

### Database

**No migrations required.**

Both deferred fields are already nullable:

```58:68:packages/db/migrations/001_initial.sql
CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname text,
  gender child_gender NOT NULL DEFAULT 'unspecified',
```

`date_of_birth` was added nullable in `027_child_date_of_birth.sql`, and is read
only by the onboarding child screens, `me.ts`, and `src/lib/dates.ts`. No
playdate, matching, or circle logic depends on it, so leaving it empty is safe.

`children.school_id` is nullable at the schema level but remains mandatory in
the application; `POST /children` already rejects the placeholder school.

**Data work, not schema work:** `schools.board_codes` exists already but
defaults to `'{}'`.

```49:50:packages/db/migrations/013_school_reviews.sql
  ADD COLUMN board_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN grades_offered text,
```

Populating it during the ongoing school-catalogue seeding lets screen 3 narrow
the board chips to the boards that school actually offers, or skip the board
question entirely when there is exactly one. Worth adding to the collection
template now rather than backfilling later.

### Backend

**1. `apps/api/src/routes/schools.ts` — `/search`: location must rank, not filter.**

Remove the `city ILIKE $4 OR pin_code = $5` predicate from the `WHERE` clause
(lines 125–129). Keep the `CASE WHEN pin_code = $5 THEN 0 ELSE 1 END` term in
`ORDER BY`. Add `verified DESC` to the relevance ordering so seeded records
outrank parent-created duplicates as the catalogue grows.

**2. `apps/api/src/routes/me.ts` — `POST /children`: relax private fields.**

```189:196:apps/api/src/routes/me.ts
    const nickname = body.nickname?.trim();
    if (!nickname) {
      return c.json({ error: "nickname is required" }, 400);
    }
    const dateOfBirth = parseChildDateOfBirth(body.dateOfBirth);
    if (!dateOfBirth) {
      return c.json({ error: "Valid dateOfBirth is required (YYYY-MM-DD)" }, 400);
    }
```

Accept both as optional and insert `null`. `curriculumId`, `gradeId` and
`schoolId` stay required. `PATCH /children/:id` already supports filling them in
later, so the in-app completion path needs no change.

**3. `apps/api/src/routes/schools.ts` — expose `boardCodes` on list rows.**

`mapSchoolListRow` omits `board_codes` today although `/compare` already selects
it. Including it in the search response is what allows screen 3 to preselect or
narrow the board.

**No change needed** to the onboarding gate. `PATCH /location` writes
`onboarding_complete = false` when no child exists yet, and `POST /children`
flips it to true once both rows are present. The reordering is transparent to
`evaluateOnboardingComplete`.

### Frontend

#### Auth entry point

| File | Change |
| --- | --- |
| `app/(intro)/index.tsx` | Delete the blocking five-scene carousel. Surviving pitch content becomes a compact swipeable strip component. |
| `app/(intro)/_layout.tsx` | Delete with the route. |
| `src/lib/intro.ts` | Delete, along with the `vaara_intro_complete` SecureStore key. |
| `app/index.tsx` | Remove the `hasCompletedIntro` branch; an unauthenticated first launch goes straight to `/(auth)/register`. |
| `app/(auth)/register.tsx` | Apple and Google first; email and password collapsed behind "Use email instead"; role selector demoted to a small "I'm a teacher or school" link; pitch strip at the bottom. |
| `app/(auth)/login.tsx` | Same social-first ordering and pitch strip. |

#### Onboarding sequence

| File | Change |
| --- | --- |
| `src/lib/auth-navigation.ts:22` | Route parents to `/onboarding/location` instead of `/onboarding/children`. |
| `app/index.tsx:31` | Make the incomplete-parent redirect resume-aware: no location → location; location but no child → school. |
| `app/onboarding/location.tsx` | Becomes step 1 of 3. PIN and country only, locality auto-filled and editable via the existing `lookupPostalCode`. Move the community name field out of onboarding. |
| `app/onboarding/school.tsx` | **New.** Step 2 of 3, school selection only. |
| `app/onboarding/class.tsx` | **New.** Step 3 of 3, board and class. Creates the child record on submit. |
| `app/onboarding/ready.tsx` | **New.** Payoff screen listing joined circles via the existing `api.getCircles`. |
| `app/onboarding/_layout.tsx` | Register the new routes. |
| `app/onboarding/add-children.tsx` | Delete the legacy redirect. |

#### Children management stays, but leaves the gate

`app/onboarding/children/index.tsx` is already the in-app "My Children" screen:

```147:148:apps/mobile/app/(app)/profile.tsx
          label="My Children"
          onPress={() => openMore("/onboarding/children", "children")}
```

It keeps that role. Remove its "Step 1 of 2" heading, its blocked Continue
button, and the `children.length === 0` guard. `app/onboarding/children/add.tsx`
keeps the full form for adding a second child, where the extra fields are
acceptable.

#### Remove defaults

| File | Change |
| --- | --- |
| `app/onboarding/class.tsx` | Board and class both start unselected; primary button disabled until both are chosen. |
| `app/onboarding/children/add.tsx:53-57` | Stop preselecting curriculum and first grade. |
| `src/constants/onboarding.ts` | Delete `pickDefaultCurriculum`; nothing selects a board on the parent's behalf any more. |
| `src/components/onboarding/ChildFormFields.tsx` | Class chips disabled with a "pick a board first" hint until a board is selected. |

`isLimitedCurriculum` must be surfaced explicitly: a parent selecting IB PYP for
a grade 9 child needs a message explaining the class is not offered on that
board, not an empty row of chips.

#### School picker

| File | Change |
| --- | --- |
| `src/components/onboarding/SchoolPicker.tsx` | Hide the create-school form behind a "Can't find your school?" link so it is a fallback rather than an invitation to create duplicates. |
| same, line 102 | Make branch optional; require name and city only. A parent should not have to guess a branch label that must match what other parents guessed. |
| same | Prefill city, state and PIN from the location step, which now has values. |

#### Types and copy

| File | Change |
| --- | --- |
| `src/lib/api.ts:51` | `Child.nickname` becomes `string \| null`. |
| `src/lib/api.ts:740-745` | `addChild` body: `nickname` and `dateOfBirth` become optional. |
| all child renderers | Fall back where nickname is null. `ChildCard` already does this. |
| all new screens | Apply the microcopy table above. |

#### In-app completion prompts

Non-blocking prompts, shown after the first session rather than during
onboarding:

- Child nickname and date of birth, framed as a privacy feature.
- Additional children.
- Housing community name, which creates the `community` circle.

## Instrumentation

`src/lib/analytics.ts` currently exposes only `tutorial_begin`,
`onboarding_children_complete`, `tutorial_complete`, plus auth conversions.
`trackOnboardingBegin` fires after sign-up, so the pre-account funnel is blind.

Add per-step events:

| Event | Fires when |
| --- | --- |
| `signup_view` | register screen mounts |
| `signup_method_selected` | Apple / Google / email chosen |
| `onboarding_location_complete` | step 1 submitted |
| `onboarding_school_complete` | step 2 submitted |
| `onboarding_class_complete` | step 3 submitted |
| `onboarding_ready_view` | payoff screen shown |
| `school_search_no_results` | search returns empty for a query ≥ 3 chars |
| `school_create_opened` | "Can't find your school?" tapped |
| `school_created` | a parent creates a school record |

Move `trackOnboardingBegin` to the first onboarding step. The school events
double as a catalogue coverage report: every `school_create_opened` marks a gap
in the seed data, and `school_search_no_results` captures the query text worth
seeding next.

### Success metrics

- **Primary:** share of app opens that reach `onboarding_ready_view`.
- **Secondary:** median time from `signup_view` to `onboarding_ready_view`.
- **Guardrail:** rate of parents editing board or class within seven days, which
  detects mis-placement. This should not rise as friction falls.
- **Catalogue health:** `school_created` as a share of `onboarding_school_complete`.

## Edge cases and risks

| Case | Handling |
| --- | --- |
| School in a different city from the parent | Fixed by removing the search location filter. Name search is authoritative. |
| School genuinely missing from the catalogue | Create fallback behind a link; name and city only; city prefilled from step 1. |
| Board with no matching class (IB PYP, grade 9) | Explicit `isLimitedCurriculum` message. |
| Parent abandons mid-onboarding and returns | Resume-aware redirect in `app/index.tsx` sends them to the first incomplete step. |
| Existing children attached to the placeholder school | Never receive `school` or `school_class` circles. Worth a one-off audit query; not blocking. |
| Duplicate school records | `verified DESC` in ranking, plus the create form being a hidden fallback. |
| Social auth cancelled | Existing `SocialAuthSection` error handling is unchanged. |

## Out of scope

- Public read-only browsing before account creation. Every API route sits behind
  `authMiddleware`, so this would require carving out public endpoints and a
  guest quota model. Revisit separately.
- Provider onboarding, which keeps its existing `/onboarding/provider` flow.
- Auto-selecting or restricting the board from `board_codes`. Step 3 sorts the
  school's recorded boards to the front but keeps every board selectable, so
  incomplete or wrong seed data can never hide the board a parent needs.
- `expo-location` and coordinate-to-PIN resolution.

## Implementation order

1. Backend: search filter fix, optional nickname and date of birth, `boardCodes`
   on list rows.
2. Shared: `api.ts` type changes and analytics events.
3. Frontend: auth entry point, then the three onboarding screens, then the
   payoff screen.
4. Cleanup: delete the intro route and flag, unhook the children list from the
   gate.

### Acceptance criteria

- A new parent reaches home in four taps plus one school search and two chip
  selections, having typed only a PIN, a school query, and their credentials
  (zero credentials via Apple or Google).
- No screen shows a pre-selected board or class.
- School search for a school outside the parent's city returns that school.
- A parent with no nickname or date of birth on file has a complete onboarding
  state and full circle membership.
- The payoff screen lists five circles for a single-child parent.
