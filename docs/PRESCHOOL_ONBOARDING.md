# Preschool onboarding (3 and 4 years)

**Status:** agreed, not yet implemented.  
**Date:** 17 September 2026.

This is the specification for letting **preschool parents of 3- and 4-year-olds**
finish sign-up and land in research rooms with other nearby parents of the same
age. It does not replace school-age onboarding.

Related:

- Shipped school-age flow — [`ONBOARDING_DISCOVERY_PLAN.md`](./ONBOARDING_DISCOVERY_PLAN.md)
- Circle derivation — `apps/api/src/services/circle-sync.ts`
- Pregnancy (parked, different identity: skip school) —
  [`FUTURE_PREGNANCY_ONBOARDING.md`](./FUTURE_PREGNANCY_ONBOARDING.md)

Pregnancy stays parked. Preschool is **not** pregnancy: there is a child, there
is usually a campus, and matching is by **age + PIN**, not by board + class.

---

## Why

School-age onboarding assumes:

```
PIN → one K–12 school → board + class → circles
```

A 3- or 4-year-old parent does not think in CBSE / SSC / LKG. Many campuses
(Kidzee, EuroKids, KLAY, Montessori) have **no board**. Labels also disagree:
one school's Nursery is another's LKG. The job for this audience is:

> Compare with other parents of 3- or 4-year-olds nearby — including parents
> whose children are at a different preschool or school — and still have a
> room for my own campus.

Today they can only finish if they fake **CBSE → Nursery / LKG / UKG**. SSC and
IGCSE have no early-years classes. Copy still says K–12.

---

## Product locks (agreed)

1. **Same app, not a new mode.** One account, one feed, one onboarding gate
   (child + location).
2. **After PIN, the parent is either preschool or school-age.** Those paths
   never mix on the next screens.
3. **Preschool campus screen: Preschool dropdown *or* School dropdown.**
   Exactly one campus. A 3-year-old at Kidzee picks Preschool; a 3-year-old in
   a CHIREC / Oakridge nursery wing picks School. Same path either way.
4. **Next preschool screen: 3 years *or* 4 years.** Exactly one, per child.
   That choice is the research circle, not a board.
5. **No curriculum / board on the preschool path.** Do not show CBSE, SSC,
   IGCSE, or IB. Do not join `CURR_*` or `CLASS_{board}_{grade}` circles.
6. **2-year-olds are out of this launch.** Do not offer a 2-year circle. Do not
   put a 2-year-old on a school. Playgroup / home stays out of onboarding.
7. **Campus is required** for preschool (no “not enrolled yet”).
8. **Age circles are PIN-scoped**, not city-wide.
   Example: `3 years · 500032`, not “all 3-year-olds in Hyderabad”.
9. **Also join the campus school circle**, even if it starts empty.
10. **School-age onboarding is unchanged:** school → board + class.

---

## What does not change

| Surface | Remains |
| --- | --- |
| Auth / register | Role, email, password |
| Step 1 location | Country, PIN, locality / area |
| School-age Step 2–3 | `SchoolPicker` + board + class |
| Onboarding complete | ≥1 child **and** a `user_locations` row |
| Nickname / DOB / gender | Still not asked in onboarding; optional later |
| Pregnancy | Still parked |
| Playdates age bands | Already include 2–4 and 4–6; no change in this work |
| Home feed engine | Same posts table, same membership model |

---

## Flows

### Today (school-age only)

```
CREATE ACCOUNT (parent)
        │
        v
  STEP 1  PIN + area
        │
        v
  STEP 2  School (one list)
        │
        v
  STEP 3  Board + class
        │
        v
  STEP 4  Ready (circles)
        │
        v
     HOME FEED
```

### Target

```
CREATE ACCOUNT (parent)
        │
        v
  STEP 1  PIN + area                         ← unchanged
        │
        v
  STEP 2  What describes your child?
          ( A )  Preschool  (about 3–4 years)
          ( B )  School     (Grade / class)
          Exactly one.
        │
        ├── A  PRESCHOOL ─────────────────────────────────┐
        │                                                 │
        │   STEP 3A  Campus                               │
        │            Preschool list  XOR  School list     │
        │            Exactly one campus.                  │
        │                   │                             │
        │                   v                             │
        │   STEP 4A  Age circle                           │
        │            3 years  XOR  4 years                │
        │            Exactly one.                         │
        │                   │                             │
        └── B  SCHOOL-AGE ── STEP 3B School               │
                             STEP 4B Board + class        │
                                    │                     │
                                    v                     v
                             STEP 5  Ready (circles)
                                    │
                                    v
                                 HOME FEED
```

Routes (locked):

| Path | Screen | Route |
| --- | --- | --- |
| Shared | PIN + area | `/onboarding/location` |
| Shared | Campus + track | `/onboarding/school` — **Preschool XOR School** control on this screen |
| Preschool | 3 / 4 years | `/onboarding/age` **new** |
| School-age | Board + class | `/onboarding/class` (today) |
| Shared | Circles confirmation | `/onboarding/ready` |

No separate `/onboarding/stage` screen. Track lives on the campus screen as
two mutually exclusive lists (Preschool dropdown or School dropdown).

---

## Screen-by-screen

### Step 1 — PIN + area

No behaviour change. Copy can stay locality / “parents from different schools”.
Preschool parents still belong in the PIN room; that is part of research.

Draft already stored: country, PIN, locality.

---

### Step 2 — Stage (Preschool vs School)

**Rule:** exactly one.

| Choice | Meaning | Next |
| --- | --- | --- |
| Preschool (about 3–4 years) | Child is in early years | Campus with two lists |
| School | Child is in a grade / class | Today's school picker |

Copy (preschool selected):

- Title: connect with parents of **3- and 4-year-olds** nearby.
- Do not say “same grade” or “K–12 board”.

Persist `track` on the onboarding draft (`preschool` | `school`) so resume and
back-navigation keep the path.

---

### Step 3A — Campus (preschool track only)

One screen, two mutually exclusive dropdowns / lists:

```
┌─────────────────────────────────────────┐
│  Where does your child go?              │
│                                         │
│  ( ) Preschool                          │
│      [ Kidzee · Kondapur            ▾ ] │
│                                         │
│  ( ) School                             │
│      [ CHIREC · Gachibowli          ▾ ] │
│                                         │
│  Continue                               │
└─────────────────────────────────────────┘
```

Locks:

- Selecting Preschool **clears** any School pick, and the reverse.
- Continue is disabled until exactly one campus is selected.
- Shortlist + typed search stay as they are today, but **filtered by list**
  (see [Catalog](#catalog--school-search-filter)).
- Parent-created campus: “Add preschool” vs “Add school” sets `schools.kind`
  so the row lands in the right list next time.
- Default city / PIN / locality for create-school still come from Step 1.

This is the “filter school search” rule, in the UI they already described:
preschool parents must not scroll Grade 1–12 names unless they explicitly open
the **School** list (nursery wings of K–12 campuses).

---

### Step 4A — Age circle (preschool track only)

**Rule:** exactly one, for this child.

```
┌─────────────────────────────────────────┐
│  Join the parents of children who are   │
│  the same age in your area.             │
│                                         │
│  ( )  3 years                           │
│       Parents of 3-year-olds · 500032   │
│                                         │
│  ( )  4 years                           │
│       Parents of 4-year-olds · 500032   │
│                                         │
│  Continue                               │
└─────────────────────────────────────────┘
```

- No board chips. No Nursery / LKG / UKG chips.
- PIN in the subtitle comes from Step 1 (example `500032`).
- Continue creates the child and runs circle sync, then goes to Ready.

Why not one combined “3–4 years” room: 4-year-olds are usually researching
LKG / next school; 3-year-olds are not. Separate rooms keep the talk useful.
Density is recovered by scoping to PIN, not by merging ages.

---

### Steps 3B / 4B — school-age

Unchanged. School picker shows **school** campuses (not standalone
preschools). Board + class unchanged, including CBSE Nursery / LKG / UKG for
parents who still identify that way on the school-age path.

A parent who should have used preschool but picked School can still complete
via CBSE Nursery. We do not block that; the preschool path is the intended
one for 3–4.

---

### Step 5 — Ready

Same screen. List the circles that were actually joined.

Preschool example (PIN `500032`, Kidzee Kondapur, 3 years):

- Kidzee · Kondapur *(school)*
- Kidzee · Kondapur · 3 years *(school × age, tightest campus room)*
- 3 years · 500032 *(research room)*
- 500032 · Gachibowli *(locality)*
- Prestige Lakeside *(community, if they entered one)*

Do **not** show “CBSE Parents” or “CBSE · Nursery”.

---

## Circles

### School-age child (unchanged)

From `syncCircleMembership()` today:

```
Child: CBSE · Grade 3 · Oakridge · PIN 500032 · Prestige Lakeside

        ┌─ school_class  Oakridge · CBSE · Grade 3     ← tightest
        ├─ class         CBSE · Grade 3
        ├─ school        Oakridge
        ├─ community     Prestige Lakeside
        ├─ locality      500032
        └─ curriculum    CBSE Parents                  ← widest
```

### Preschool child (new)

```
Child: 3 years · Kidzee Kondapur · PIN 500032 · Prestige Lakeside

        ┌─ school_class  Kidzee Kondapur · 3 years     ← tightest campus
        ├─ age_locality  3 years · 500032              ← research room
        ├─ school        Kidzee Kondapur
        ├─ community     Prestige Lakeside
        └─ locality      500032

        Not joined: curriculum, class (board × grade)
```

Do **not** reuse `school_class` for campus × age. Existing code assumes
`school_class` always has curriculum + grade metadata (author labels, chat
access, linear chat). Use a dedicated type.

### New circle types

```sql
ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'age_locality';
ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'school_age';
```

| Type | Key | Display name | When |
| --- | --- | --- | --- |
| `school` | `SCHOOL_{normalized_key}` | `Kidzee · Kondapur` | preschool and school-age |
| `school_age` | `SCHOOL_AGE_{normalized_key}_Y3` | `Kidzee · Kondapur · 3 years` | preschool (+ experienced overlap) |
| `age_locality` | `AGE_POSTAL_{country}_{pin}_Y3` | `3 years · 500032` | preschool (+ experienced overlap) |
| `locality` | `PIN_{pin}` | existing | both |
| `community` | `COMM_{key}` | existing | both |

Use `Y4` in keys for 4 years. Country is required in `age_locality` keys
because postal codes collide internationally.

Do **not** create:

- `CURR_CBSE` / `CURR_EARLY_YEARS` / any curriculum circle
- `CLASS_CBSE_NURSERY` or a global `CLASS_Y3` (that would be city- or
  board-wide; research is PIN-scoped)

### Feed / author ranking

Insert `school_age` with school_class tightness; `age_locality` above locality:

```
school_class / school_age → class → school → age_locality → community → locality → curriculum
```

Primary feed includes `age_locality`. Discovery stays “circles you are not in”.

Surfaces that switch on `circle_type` must learn the new value:

- `apps/api/src/services/circle-sync.ts`
- `apps/api/src/services/feed.ts`
- `apps/api/src/lib/author.ts`
- `apps/api/src/services/notifications.ts`
- composer circle picker / `POST_COMPOSER_CIRCLES_AND_INTERESTS.md`
- `apps/mobile/src/lib/circle-icons.ts`
- group chat / `docs/GROUP_CHAT_MODEL.md`
- API `Circle` type in `apps/mobile/src/lib/api.ts`

Suggested icon: same as locality (`home`) or `people`.

### Two preschool children

A parent with a 3-year-old and a 4-year-old (second child added later) sits in
**both** age rooms and both campus rooms if the campuses differ. Same as two
school-age grades today.

---

## Data model

### `schools.kind`

Catalog rows are not distinguishable today (`grades_offered` is free text).
Add an explicit kind so the two dropdowns can query without name heuristics.

```sql
CREATE TYPE school_kind AS ENUM ('preschool', 'school');

ALTER TABLE schools
  ADD COLUMN kind school_kind NOT NULL DEFAULT 'school',
  ADD COLUMN offers_preschool boolean NOT NULL DEFAULT false;
```

| Field | Appears in |
| --- | --- |
| `kind = preschool` | Preschool dropdown (preschool track) |
| `kind = school AND offers_preschool` | School dropdown on preschool track |
| `kind = school` | School-age picker |

Backfill (first pass, then hand-correct):

- `kind = preschool` if name / `grades_offered` matches playschool, preschool,
  daycare, Montessori, Kidzee, EuroKids, KLAY, Footprints, Kangaroo Kids,
  Dibber, and similar, **and** the campus is not a K–12 continuation school.
- Everyone else stays `kind = school`.
- K–12 brands with a **separate preschool campus** (e.g. CHIREC preschool)
  are `kind = preschool`. The main K–12 campus stays `kind = school`.
- `offers_preschool = true` when `grades_offered` mentions Nursery / LKG /
  UKG / Kindergarten / Pre-primary, or when `kind = preschool`.

School-age Step 2 should **hide** `kind = preschool` so Grade 5 parents do not
land in Kidzee. If a parent created a preschool from the preschool path, it
must not pollute the school-age list.

### `children` — preschool without a board

Today `curriculum_id`, `grade_id`, and `school_id` are **NOT NULL**, and
`POST /v1/me/children` rejects a missing board. That is the school-age
contract. Preschool must not pretend to be CBSE.

```sql
ALTER TABLE children
  ADD COLUMN track text NOT NULL DEFAULT 'school'
    CHECK (track IN ('school', 'preschool')),
  ADD COLUMN age_years smallint
    CHECK (age_years IS NULL OR age_years IN (3, 4)),
  ADD COLUMN age_confirmed_at timestamptz,
  ADD COLUMN experienced_age_years smallint
    CHECK (experienced_age_years IS NULL OR experienced_age_years IN (3, 4)),
  ADD COLUMN age_circle_until timestamptz;

ALTER TABLE children
  ALTER COLUMN curriculum_id DROP NOT NULL,
  ALTER COLUMN grade_id DROP NOT NULL;
```

Constraints to enforce in a check **and** in the API:

| `track` | `school_id` | `curriculum_id` / `grade_id` | `age_years` |
| --- | --- | --- | --- |
| `school` | required | required, matching pair | null (may have experienced_*) |
| `preschool` | required | **null** | 3 or 4 |

Existing rows: `track = 'school'`, `age_years = null`.

Do **not** add a hidden `EARLY_YEARS` curriculum just to satisfy NOT NULL.
That would leak “Early years Parents” curriculum circles and reintroduce the
board concept we are removing.

`syncCircleMembership` currently `JOIN`s curriculum, grade, and school on
every child. Split the query (or left-join) so preschool rows still sync.

### Onboarding complete

Unchanged:

```
≥1 child  AND  a user_locations row
```

A preschool child counts. Location is still required first.

---

## API

### `POST /v1/me/children`

Accept a preschool body **or** a school-age body, not a hybrid.

School-age (today):

```json
{
  "schoolId": "…",
  "curriculumId": "…",
  "gradeId": "…",
  "gender": "unspecified",
  "onboardingAttemptId": "oba_…"
}
```

Preschool:

```json
{
  "track": "preschool",
  "schoolId": "…",
  "ageYears": 3,
  "gender": "unspecified",
  "onboardingAttemptId": "oba_…"
}
```

Validation:

- `track=preschool` → require `schoolId` + `ageYears` in `{3,4}`; reject
  `curriculumId` / `gradeId` if sent; set them null.
- `track` omitted or `school` → today's rules (`curriculumId`, `gradeId`,
  `schoolId` required); reject `ageYears`.
- School must exist, not placeholder, not redirected.
- For preschool, school `kind` may be `preschool` **or** `school` (nursery
  wing). Do not require `kind=preschool` or CHIREC parents cannot finish.

`PATCH /v1/me/children/:id` must allow:

- staying on preschool and changing campus or 3 ↔ 4 (leave old age room,
  join new — same as grade promotion);
- promoting preschool → school-age when they pick board + class (clear
  `age_years`, set `track=school`, leave `age_locality` / `SCHOOL_AGE_*`).

Do not allow a row that has both a board and `age_years`.

### School search / shortlist / nearby / catalogue

Add query param `kind`:

- `kind=preschool` — Preschool dropdown
- `kind=school` — School dropdown (preschool track) and school-age picker
- omitted — do not use in onboarding; avoid mixing lists

Public catalogue / Redis packs used by Step 2 should be splittable by `kind`
(or filtered client-side if the pack stays small). Shortlist affinity
(`school_pin_affinity`) already ranks by what parents in the PIN chose; after
preschool parents exist, preschool shortlists will fill naturally. Until then,
verified `kind=preschool` in region / locality is the fallback, same as
today's directory fallback.

Create-school payload: send `kind` from which dropdown opened Add.

### Child JSON

Include `track` and `ageYears` on `Child`. Mobile types, draft, and family
meta (`seedHomeMeta`) must persist them.

---

## Catalog / school search filter

This is **not** a separate product. It is how the two dropdowns stay usable.

**Preschool dropdown**

- `schools.kind = 'preschool'`
- Verified, or created by this user
- Rank: PIN affinity → locality / region directory → typed name
- Create CTA: “Add preschool”

**School dropdown (on the preschool path)**

- `schools.kind = 'school'`
- Same ranking
- Intended for K–12 campuses with a nursery / early-years wing
- Create CTA: “Add school”

**School-age picker**

- `schools.kind = 'school'` only
- Today's UX otherwise

Without `kind`, one list of 200+ West Hyderabad names buries Kidzee under
Grade 1–12 CBSE campuses. That is the failure mode this filter exists to
prevent.

Catalog fill (Kidzee / EuroKids / KLAY / missing preschool campuses) is
**parallel data work**, not a blocker for the UX to ship, but empty
dropdowns in a PIN will feel like a broken path. Prefer backfilling West
Hyderabad preschools before turning the path on in production.

---

## Mobile onboarding draft and resume

Extend `apps/mobile/src/lib/onboarding-draft.ts`:

- `track`: `preschool` | `school`
- `ageYears`: `3` | `4` | null
- `step`: add `stage` and `age` (keep `school`, `class`, `ready`)

`resolveParentOnboardingHref`:

```
no location            → /onboarding/location
no track               → /onboarding/stage  (or school with no track)
preschool, no campus   → /onboarding/school (preschool UI)
preschool, no age      → /onboarding/age
preschool, has child   → /onboarding/ready
school, no campus      → /onboarding/school
school, no class       → /onboarding/class
has child              → /onboarding/ready
```

Clear the opposite-path fields when track changes (don't resume a CBSE grade
onto a preschool child).

---

## Post-onboarding: add / edit child

`ChildFormFields` grows a track control:

- **School** → today's school + board + class (gender required as today).
- **Preschool** → same two campus lists + 3 / 4 years; hide board; gender
  still required on this screen (existing add-child rule).

A family may have mixed children (Grade 3 sibling + 4-year-old). Circle sync
unions both sets.

When promoting a preschool child into Grade 1, edit to School track. They
leave age rooms and join board / class rooms. Do not auto-promote on birthday;
there is no required DOB.

---

## Copy

| Place | Do not say | Say |
| --- | --- | --- |
| Preschool campus | Connect with the same grade | Connect with parents at this preschool / school |
| Age screen | K–12 board, Nursery through 12th | Parents of 3-year-olds / 4-year-olds in your area |
| Board blurbs | Only on school-age class screen | unchanged |
| `curriculumChipLabel` | Not shown on preschool | unchanged for school-age |
| Ready | CBSE Parents | Age + campus + PIN names above |

---

## Analytics

Existing events stay on the school-age path.

Add:

| Event | When | Properties (non-PII) |
| --- | --- | --- |
| `onboarding_track_selected` | Parent picks Preschool or School on campus screen | `{ track }` |
| `onboarding_school_view` | Campus screen shown | `{ track? }` |
| `onboarding_school_complete` | Campus chosen | `{ track, school_kind, offers_preschool? }` |
| `preschool_selected` | Preschool track campus chosen | `{ school_kind }` |
| `onboarding_age_view` | Age screen shown | — |
| `onboarding_age_complete` | 3 or 4 chosen and child created | `{ age_years }` |
| `age_circle_selected` | Same moment as age complete | `{ age_years }` |

`onboarding_class_view` / `onboarding_class_complete` fire only on school-age.
`onboarding_completed` / `tutorial_complete` still fire on Ready for both paths.

Funnel to watch: track → campus selected → age selected → ready. If campus
search is empty, parents will bounce here first — log `school_create_opened`
with `{ track, school_kind }`.

---

## Age progression and experienced parents

Age circles must not remove parents the day they start LKG / Grade 1. Those
parents are useful guides.

### Lifecycle

```
Current 4-year parent
        │  (calendar reminder, ~3–4 months before school year)
        v
Confirms school + board + class
        │
        v
School/class circles  +  still in 4-year · PIN for ~12 months
        │  (labelled Experienced parent in UI when shown)
        v
After age_circle_until → leave age / school_age rooms
School/class only
```

### Reminder timing (not “10–12 months after signup”)

Use the **regional academic calendar**, not elapsed time since onboarding:

- India / Hyderabad default: school year starts ~June → first reminder
  around **February–March**, second around school start if unanswered.
- Never auto-transition. Options: *Update school details* / *Not yet* /
  *Remind me later*.

### Schema fields for this

| Column | Purpose |
| --- | --- |
| `age_confirmed_at` | When parent last confirmed 3 or 4 |
| `experienced_age_years` | Age band kept during overlap (3 or 4) |
| `age_circle_until` | Keep age_locality + school_age until this timestamp |

On promote preschool → school: set board/grade, clear `age_years`, set
`experienced_age_years` from the old value, set `age_circle_until` to
~12 months ahead. Circle sync still joins age rooms while
`age_circle_until > now()`.

Same rule for **3 → 4** inside preschool: leave Y3 rooms, join Y4, update
`age_confirmed_at`. No experienced overlap needed for that hop.

---

## Out of scope (this launch)

- **2-year-olds / playgroup** — no school, no 2-year circle.
- **“Not enrolled yet”** — campus is required.
- **Pregnancy / expecting** — still [`FUTURE_PREGNANCY_ONBOARDING.md`](./FUTURE_PREGNANCY_ONBOARDING.md).
- **Date of birth required** — age band 3 / 4 is enough.
- **Pre-Nursery / Playgroup / Montessori level labels** — we store 3 or 4
  years, not the school's internal name.
- **A combined 3–4 PIN room** — two rooms, not one.
- **City-wide age rooms** — PIN only.
- **Separate preschool feed, app, or posts table.**
- **Forcing board on a School-dropdown pick** (CHIREC nursery still skips
  board).
- **Auto grade-promotion** when the child turns 5.
- **Reminder push scheduling UI** — fields land in schema; in-app prompt
  can ship after core onboarding.

---

## Implementation order

1. **Schema** — `school_kind`, `children.track`, `children.age_years`,
   nullable curriculum/grade, `circle_type` value `age_locality`.
2. **Backfill `schools.kind`** — West Hyderabad first; spot-check K–12 vs
   preschool campuses of the same brand.
3. **`syncCircleMembership` + feed/author/notifications ranking** for
   `age_locality` and preschool `school_class` keys; skip curriculum/class
   when `track = preschool`.
4. **`POST`/`PATCH /v1/me/children`** preschool body; school search `kind`.
5. **Mobile** — stage, dual campus lists, age screen, draft/resume, Ready
   copy, add/edit child, circle icon.
6. **Tests** — circle sync matrix; API validation; e2e parent who picks
   preschool + 3 years reaches ready with the expected five circle types
   (no `curriculum` / board `class`).
7. **Catalog fill** can overlap 2–6 but should be in place before a
   production flag goes on.

Ship school-age untouched behind `track=school` (the default).

---

## Test plan

- School-age parent: PIN → School → CBSE Grade 3 → ready. Circles identical
  to today. Preschools do not appear in the school-age list.
- Preschool + Preschool dropdown + 3 years: joins `school`, `school_class`
  (age), `age_locality`, `locality` (+ community if set). Never joins
  `curriculum` or board `class`.
- Preschool + School dropdown (K–12 campus) + 4 years: same circle shapes,
  campus is the K–12 school, still no board.
- Cannot select both dropdowns; switching lists clears the other campus.
- Cannot select both 3 and 4; changing 3 → 4 leaves `AGE_PIN_*_Y3` and joins
  `Y4`.
- Resume after kill: preschool draft does not land on `/onboarding/class`.
- Add second child as school-age: parent is in both preschool age rooms and
  Grade-3 rooms.
- Promote preschool child to Grade 1: `age_years` cleared; age circles left.
- Create preschool from Add preschool: `kind=preschool`; appears next time
  in Preschool list only.
- `evaluateOnboardingComplete` true after preschool child + location.
- Composer can post to `age_locality` and campus circles.
- 2 years is not offered anywhere in onboarding.

---

## Files likely to change

| Area | Files |
| --- | --- |
| Migration | `packages/db/migrations/` (new) |
| Kind backfill | `packages/db/scripts/` + existing West Hyderabad seed |
| Circle sync / complete | `apps/api/src/services/circle-sync.ts` |
| Children API | `apps/api/src/routes/me.ts` |
| School search | `apps/api/src/routes/schools.ts`, `school-shortlist.ts` |
| Feed / labels | `apps/api/src/services/feed.ts`, `lib/author.ts`, `services/notifications.ts` |
| Onboarding UI | `apps/mobile/app/onboarding/school.tsx`, new `stage.tsx` / `age.tsx`, `ready.tsx` |
| Draft / routing | `onboarding-draft.ts`, `auth-navigation.ts` |
| Add/edit child | `ChildFormFields.tsx`, `children/add.tsx`, `children/edit/[id].tsx` |
| Types | `apps/mobile/src/lib/api.ts` |
| Tests | `apps/api/test/` circle-sync + children + e2e audit |

---

## One-line summary

After PIN, the parent chooses **Preschool or School**. Preschool picks
**one campus** (preschool list or school list) and **either 3 years or 4
years**, joins that age room in their PIN plus the campus, and never sees a
board. School-age stays as it is. 2-year-olds are not in this launch.
