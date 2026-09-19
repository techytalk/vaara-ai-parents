# Onboarding location — locality UX

Decision doc for Step 1 (`/onboarding/location`). Supplements
`ONBOARDING_SIGNUP_REDESIGN.md`.

**Status:** implemented in `apps/mobile/app/onboarding/location.tsx`.
**Date:** 16 September 2026 (revised 19 September 2026).

**In scope:**

1. Locality control → **inline selectable list** (height-budgeted; searchable sheet when options overflow)
2. Escape hatch **“My area isn’t listed”** (free text only when needed)
3. **Continue** docked above the keypad (Post / Save pattern)
4. **PIN field stays above the keyboard** while typing

**Out of scope:** city/state field changes, API / backend changes, community
field, ranking of postal names, 2G / Redis / on-device packs, school step,
child identity, or any other onboarding screen.

---

## Problem

1. A closed “Select area ▾” hid choices after PIN lookup and competed with an
   always-visible **“Or type a different area”** field — parents typed instead
   of picking a known locality (worse for circle matching).
2. Continue must stay above the keypad (solved earlier with the Post/Save dock).
3. While typing the PIN, digits must stay visible above the IME (not only Continue).

---

## Area picker UX (current — 19 Sep 2026)

| Options from PIN lookup | UI |
| --- | --- |
| **0** / lookup fail / unsupported country | Free-text **Locality / area *** (required); keep keyboard and focus the field |
| **1** | Auto-select; `placeLine` is the confirmation; link “My area isn’t listed” |
| **2–budget** | **Inline radio rows** on the screen; link under list: “My area isn’t listed” |
| **> budget** | Show `budget − 1` rows + **“Show all N areas”** → searchable sheet |

**Row budget by usable height** (`windowHeight − headerHeight`):

| Band | Usable height | Inline budget |
| --- | --- | --- |
| Short | &lt; 560 | 4 |
| Regular | 560–700 | 6 |
| Tall | &gt; 700 | 8 |

“My area isn’t listed” reveals **one** free-text field and clears a listed
selection. Do **not** show a free-text field by default when options exist.

If a saved / typed locality is not in the returned options after lookup, start
in the “not listed” state so the value stays visible.

Country field remains a closed dropdown (unchanged).

### Keyboard after lookup

| Lookup result | Keyboard |
| --- | --- |
| ≥ 1 areas | **Dismiss** number pad, then scroll to the area block |
| 0 areas / error | Keep keyboard; focus free-text locality |

PIN focus: wrap the PIN block in `onLayout`, `scrollTo` on focus, and add
`paddingBottom: 28 + keyboardHeight` on the `ScrollView` content so there is
room to scroll the field above the IME. Continue stays in the footer dock only.

### ASCII — multiple areas (typical)

```text
PIN: 502032
📍 Tellapur · Telangana

Choose your area
○ Chilakaluripet
● Tellapur
○ Chilakaluripet Bazar

My area isn’t listed

[ Continue ]
```

### Analytics

`area_selected` sources (as of 19 Sep 2026):

| Source | When |
| --- | --- |
| `list` | Inline radio row |
| `sheet` | Searchable overflow sheet |
| `not_listed` | Escape hatch (link or typing after escape) |
| `typed` | Free text when lookup returned no options |

Retired: `dropdown` (closed area picker). Treat a drop in `dropdown` after this
date as expected, not a funnel regression.

### Implementation note

Primary file: `apps/mobile/app/onboarding/location.tsx`. No API change.
`canContinue` remains: valid PIN + non-empty locality.

---

## How Continue sits above the keypad

Reference implementation: **Post** and **Save** on
`apps/mobile/app/circles/[circleId]/new-post.tsx`.

```
Existing onboarding SafeAreaView (in _layout.tsx; do not duplicate)
  KeyboardAvoidingView            ← iOS padding + headerHeight offset
    ScrollView                    ← fields / body only
    footerDock                    ← OUTSIDE ScrollView
      PrimaryButton Continue
      OnboardingAccountSwitch     ← first-run only
      + useAndroidImeDockOffset(0) margin on Android
```

Why `0`: onboarding `_layout.tsx` already reserves the closed-state bottom safe
area. The hook only adds Android IME height when the window does not resize.

---

## Superseded (do not implement)

> The sections below describe the **16 Sep closed-dropdown** approach. They are
> kept for history only. The **19 Sep revision** above is authoritative.

### ~~Locality dropdown rules~~ (superseded)

~~1. `localityOptions.length > 0` → pressable “Select area” + chevron; opens a Modal.~~
~~2. Optional “Or type a different area” under the dropdown: leave as today.~~

Replaced by inline list + “My area isn’t listed” escape. No always-visible
override field. No closed area dropdown for the common case.

### ~~Target UI with dropdown~~ (superseded)

```text
~~Your area~~
~~│ Tellapur                 ▾  │~~   ← removed
```

### ~~Verify: different-area field always works~~ (superseded)

Free text is only shown when options are empty / lookup failed, or after the
parent taps “My area isn’t listed”.

---

## Out of scope (explicit)

- Hiding / changing city or state fields
- Server-side location save behavior
- Community / apartment field
- Postal-name ranking / “More areas” beyond the overflow sheet
- 2G CDN / Redis / on-device PIN packs
- School, class, or child onboarding screens

---

## Success signal

- Parent can enter PIN with digits visible above the keypad.
- After a successful lookup, the keypad dismisses and the area list is fully visible.
- Multi-area PIN: one tap on an inline row; Continue stays above the keypad when open.
- No always-visible free-text competing with the list.
- No other location-step behavior regressions.
