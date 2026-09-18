# Onboarding UX fixes — school picker + location scroll

**Status:** Implemented.  
**Surfaces:** `/onboarding/school`, `SchoolPicker`, `/onboarding/location`  
**Supersedes (partial):** dual campus-type chips + kind-filtered preschool lists in
`docs/PRESCHOOL_ONBOARDING.md` (§ campus screen / School dropdown filters).

---

## Why these changes

Parents should pick **Preschool (3–4)** vs **School** once, then pick a campus
from one list. Asking “Campus type: Preschool / School” again is confusing, and
filtering by `schools.kind` is unreliable while catalog kinds are incomplete.

Suggested schools already load behind a closed dropdown; keep that pattern and
make it feel like the locality dropdown (closed trigger → open list).

On location, after a valid PIN lookup the area control appears below the fold —
parents must scroll manually. Auto-scroll after lookup so the next required
choice is in view.

---

## Issue 1 — Remove campus type

### Current behavior

On `/onboarding/school`, after **What describes your child?**
(`Preschool (3–4 years)` | `School`):

- If track = preschool, a second chip row **Campus type** appears:
  `Preschool` | `School`
- That sets `campusList` → `pickerList` =
  `preschool` | `preschool_campus` | `school`
- `SchoolPicker` passes `list={pickerList}` into shortlist/search/create, which
  **filters** by school kind / preschool campus flags.

### Problem

- Parents already chose preschool vs school.
- Catalog `kind` is incomplete / uneven, so filtering hides valid campuses.
- Extra chips add text and decision load.

### Decision

1. **Remove Campus type UI** entirely from onboarding school screen.
2. **Do not filter** shortlist/search by `list` / kind on this screen.
3. Keep only:
   - Track: Preschool (3–4 years) | School  
   - One school/campus dropdown (all nearby + searchable names)
4. Track still drives the **next step**:
   - Preschool → `/onboarding/age` (3 / 4)
   - School → `/onboarding/class` (board / grade)
5. On create (“Not here / Other”):
   - Do **not** infer standalone-preschool vs K–12 `kind` from the child’s
     track; that recreates the same unreliable classification.
   - Keep the backend’s current default `kind = school` when type is unknown.
   - If track = preschool, set `offers_preschool = true` because the parent is
     confirming that this campus accepts a 3–4-year-old.
   - If track = school, do not modify `offers_preschool`.
   - Do not ask campus type again.
6. Selecting an existing campus does not rewrite its `kind` or
   `offers_preschool` catalog fields.

### Files likely touched

- `apps/mobile/app/onboarding/school.tsx` — remove `campusList`, chips, `pickerList` branching
- `apps/mobile/src/components/onboarding/SchoolPicker.tsx` — call without `list`, or ignore list on onboarding
- Shortlist/search API callers — stop passing preschool/school list filters from this screen
- `docs/PRESCHOOL_ONBOARDING.md` — note amendment: single unfiltered campus list after track

### Analytics

- Keep `onboarding_track_selected`
- Drop or stop firing campus-type-specific events if any
- `preschool_selected` / `onboarding_school_complete` still use selected school’s
  actual `kind` / `offersPreschool` when present

### Out of scope

- Backfilling missing `schools.kind` values (helpful later, not required for this UX)
- Changing age / class screens

---

## Issue 2 — Suggested schools in a closed dropdown (like locality)

### Current behavior

`SchoolPicker` already uses a closed trigger (“Select preschool/school”) and
opens search + suggested list when tapped. Locality on location uses a similar
closed dropdown that opens a modal/list of areas.

### Problem / polish goal

Make school selection **read the same** as location’s area dropdown:

- Closed by default (no always-visible suggested list)
- Tap trigger → show suggestions (and search)
- Select → close, show chosen label on trigger
- Clear / re-open to change

### Decision

1. Keep **closed-by-default** school dropdown (already mostly true).
2. Match the locality interaction, not only its styling:
   - Same trigger row pattern (label + chevron)
   - Tap opens a modal / sheet containing search + school choices
   - Empty query shows suggested schools first
   - Typing filters; “Not here / Other” remains at the end
   - Backdrop / close dismisses without changing the current selection
3. No second “suggested schools” panel outside the dropdown.
4. Selected state: trigger shows `displayLabel`; remove the duplicate selected
   card and use **trigger-only**.

### Files likely touched

- `apps/mobile/src/components/onboarding/SchoolPicker.tsx`
- Optionally share dropdown styles with `location.tsx` locality control

### Acceptance

- Opening school screen with preschool or school track: **no** expanded school
  list until user taps the dropdown
- Tap → modal / sheet opens with suggestions visible
- Type → filtered results
- Select → dropdown closes; Continue enables
- Re-open and dismiss → prior selection remains

---

## Issue 3 — After PIN entry, auto-scroll to area selection

### Current behavior

`/onboarding/location`:

1. User enters PIN
2. Debounced postal lookup fills `localityOptions`
3. Area dropdown appears **below** PIN / place line
4. User must **manually scroll** to see and choose locality when options > 1
   (or when fields appear below the fold)

### Problem

Next required action (pick area) is easy to miss; continue stays disabled until
locality is set.

### Decision

1. When PIN becomes ready for lookup and lookup **succeeds** with
   `localityOptions.length >= 1`:
   - If **exactly one** locality → auto-select it (already done) and scroll
     enough to show Continue / confirmation if needed
   - If **more than one** → **scroll the area section into view** and leave
     the locality dropdown closed until the parent taps it
2. Use a `ref` on the area block + `ScrollView.scrollTo` /
   `scrollTo({ y })` or `measureLayout` after layout.
3. Do **not** scroll on every keystroke — only after a completed successful
   lookup (same request id as the settled lookup).
4. If lookup fails or returns zero localities, do not scroll; show error /
   manual fields as today.
5. Prefill / returning users with PIN + locality already set: no forced scroll
   on mount.
6. Auto-scroll only; do **not** auto-open the locality modal or move keyboard
   focus.

### Files likely touched

- `apps/mobile/app/onboarding/location.tsx` — `ScrollView` ref, area section ref,
  post-lookup scroll

### Acceptance

- Enter a multi-area PIN → after “Finding your area…” finishes, viewport moves
  so “Where do your parent conversations happen?” / area dropdown is visible
  without manual scroll
- Single-area PIN → locality auto-filled; no confusing empty scroll
- Changing PIN to incomplete → area resets; no stray scroll

---

## Implementation order

1. Location auto-scroll (isolated, high UX win)
2. Remove campus type + unfiltered school list
3. School dropdown polish to match locality chrome

## Explicit non-goals

- Re-introducing kind filters until catalog quality is proven
- Changing PIN lookup API
- Guest-thread / messaging work in this pass

## Status

| Item | State |
|---|---|
| Remove campus type; no kind filter on onboarding school pick | Done |
| School suggestions only inside closed dropdown | Done (modal + trigger-only) |
| Auto-scroll to locality after PIN lookup | Done |
| Code | Done |
