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

Suggested schools already load behind a closed dropdown; **search-first** is the
current school sheet pattern (type a name; no shortlist dump on open). See
Issue 2.

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

## Issue 2 — School picker: search-first (revised 19 Sep 2026)

### Decision

School is **not** the same decision as home PIN / area. Do not open with a long
“nearby” shortlist.

1. Closed trigger on the school screen (“Select school”).
2. Tap → sheet with **search only** (placeholder: “Search for school name”).
3. Empty query: hint “Type a school name to search” — **no school list**.
4. Typing thresholds:
   - 0–1 characters: no results; prompt for at least 2 characters
   - 2 characters: local-catalog matches only
   - 3+ characters: local matches immediately + debounced remote search
5. After a successful 3+ character search settles: footer
   **“Can’t find your school?”** → existing create form (“Add it”). Shown
   whether results are empty or present (school might still be missing).
   Never show this escape after only one or two characters, or after a search
   error.
6. Select → close sheet; trigger shows `displayLabel`.

### ASCII

```text
Open sheet
┌─────────────────────────────┐
│ Search for school name…     │
│ Type a school name to search│
└─────────────────────────────┘

After typing with matches
┌─────────────────────────────┐
│ DPS_                        │
│ DPS Kollur                  │
│ DPS Miyapur                 │
│ Can’t find your school?     │
│ Add it                      │
└─────────────────────────────┘

No matches
┌─────────────────────────────┐
│ No schools match “XYZ”      │
│ Can’t find your school?     │
│ Add it                      │
└─────────────────────────────┘
```

### Files

- `apps/mobile/src/components/onboarding/SchoolPicker.tsx`

### Acceptance

- Open picker: no big list of schools
- Type 2 characters → local matches; 3+ → full search
- Missing school → “Can’t find your school?” → create flow
- Prior selection remains if sheet is dismissed
- The same search-first behavior applies anywhere the shared `SchoolPicker` is
  used, including child profile editing.

---

## Issue 2 (superseded) — Suggested schools shortlist on open

> Previous decision dumped PIN shortlist when the query was empty and used
> “Not here / Other”. Replaced by search-first above. Shortlist API may still
> exist server-side; the onboarding sheet no longer displays it on open.

~~Empty query shows suggested schools first~~
~~“Not here / Other” at the end of the shortlist~~

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
