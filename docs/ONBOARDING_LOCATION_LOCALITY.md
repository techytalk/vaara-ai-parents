# Onboarding location — locality UX

Decision doc for Step 1 (`/onboarding/location`). Supplements
`ONBOARDING_SIGNUP_REDESIGN.md`.

**Status:** implemented in `apps/mobile/app/onboarding/location.tsx`.
**Date:** 16 September 2026 (revised).

**In scope (this change only):**

1. Locality control → **dropdown** (when lookup returns options)
2. **Continue** positioned **above the keypad**, using the same dock pattern as
   Post / Save on the new-post / edit-post screen

**Out of scope:** city/state field changes, API / backend changes, community
field, ranking of postal names, 2G / Redis / on-device packs, school step,
child identity, or any other onboarding screen.

---

## Problem

On `apps/mobile/app/onboarding/location.tsx` today:

1. **Continue sits under the keyboard.** The screen is a single `ScrollView`.
   Continue is the last scroll content item — not a dock. After entering a PIN
   (number pad open), the parent must dismiss the keypad to reach Continue.
2. **Locality is chips + free text**, which adds height and pushes Continue
   further down.

---

## Decision

| Change | Detail |
| --- | --- |
| **Locality → dropdown** | When `localityOptions.length > 0`, replace the chip row with a Country-style pressable + modal list. Keep the existing free-text locality field when lookup has no options / fails / unsupported country. Keep existing auto-select when there is a single option. |
| **Continue above keypad** | Lift Continue and the existing “Signed in as … · Not you?” row out of the `ScrollView` into a fixed bottom dock, using the **same keyboard-dock pattern as Post / Save** on `apps/mobile/app/circles/[circleId]/new-post.tsx` (create = Post, edit = Save — one screen). |

Everything else on the location screen stays as it is today (payoff copy,
country picker, PIN field, city/state behavior, save payload, community block
for already-complete users, etc.).

---

## How Continue sits above the keypad

Reference implementation: **Post** and **Save** on
`apps/mobile/app/circles/[circleId]/new-post.tsx`.

That screen does **not** put the primary button inside the `ScrollView`. It
docks it below the scroll content and lifts the dock with the keyboard:

```
SafeAreaView (edges bottom on iOS)
  KeyboardAvoidingView
    behavior = "padding" on iOS only
    keyboardVerticalOffset = useHeaderHeight() on iOS
    …
    ScrollView (flex: 1)     ← fields / body only
    composerDock             ← OUTSIDE ScrollView
      …toolbar…
      Post / Save button
      + androidDockOffset margin on Android
```

Relevant pieces already in that file:

| Piece | Role |
| --- | --- |
| `useHeaderHeight()` | iOS `keyboardVerticalOffset` so padding clears the nav header |
| `KeyboardAvoidingView` `behavior="padding"` (iOS) | Shrinks the KAV when the keyboard opens; dock rides up with it |
| `behavior={undefined}` on Android | Avoid double-offset; Android uses the IME dock hook instead |
| Dock **sibling** of `ScrollView`, not inside it | Button stays painted at the bottom of the KAV |
| `useAndroidImeDockOffset(...)` | Android: `marginBottom` on the dock when the window does **not** resize for the IME (`apps/mobile/src/hooks/useKeyboardHeight.ts`) |
| Existing onboarding `SafeAreaView` | `app/onboarding/_layout.tsx` already applies `edges={["bottom"]}`; do not add a second safe-area wrapper |
| `keyboardShouldPersistTaps="handled"` | Retain it for controls inside the `ScrollView`; the dock is outside the scroll view and does not depend on this prop |

### Target tree for location

Mirror that structure in `location.tsx` only — reuse the same hooks / KAV
settings; do not invent a new keyboard system. The onboarding stack already
supplies the bottom safe-area inset, so use `useAndroidImeDockOffset(0)`.
Passing `useBottomChromeInset()` here as new-post does would count the bottom
inset twice while the keyboard is closed.

```
Existing onboarding SafeAreaView (in _layout.tsx; do not duplicate)
  KeyboardAvoidingView            ← iOS padding + headerHeight offset
    ScrollView                    ← all existing fields, errors and hints
    footerDock                    ← OUTSIDE ScrollView
      PrimaryButton Continue
      OnboardingAccountSwitch     ← first-run only, same as today
      + useAndroidImeDockOffset(0) margin on Android
```

Acceptance: with the PIN number pad open, Continue is visible and tappable
without dismissing the keypad — same feel as Post / Save with the body field
focused. The existing validation hint remains in the scroll content; only the
button and account-switch row move into the dock.

---

## Locality dropdown rules

1. `localityOptions.length > 0` → pressable “Select area” (or selected label) +
   chevron; opens a `Modal` + `FlatList` like Country. Selection sets
   `locality` and closes the picker.
2. No options / lookup fail / unsupported country → keep existing free-text
   “Locality / area *” field.
3. Do not change save / `canContinue` rules: valid PIN + non-empty locality.

Optional “Or type a different area” under the dropdown: **leave as today**
without changing its behavior.

---

## Target UI (keyboard open)

```
┌─────────────────────────────────────┐
│  Step 1 of 3                        │
│  …existing fields…                  │
│                                     │
│  PIN code                           │
│  ┌─────────────────────────────┐    │
│  │ 502032                      │    │  ← focused; keypad open
│  └─────────────────────────────┘    │
│                                     │
│  Your area                          │
│  ┌─────────────────────────────┐    │
│  │ Tellapur                 ▾  │    │  ← dropdown (was chips)
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │        Continue             │    │  ← dock (like Post/Save)
│  └─────────────────────────────┘    │
│  Signed in as a***@gmail.com ·      │  ← existing first-run row
│  Not you?                           │
├─────────────────────────────────────┤
│         [ system number pad ]       │
└─────────────────────────────────────┘
```

---

## Detailed code-change steps

Implementation file: `apps/mobile/app/onboarding/location.tsx` only.
Existing shared hooks and components are reused without modification.

### 1. Add keyboard-dock imports

From React Native, add:

- `KeyboardAvoidingView`
- `Platform`

Add:

- `useHeaderHeight` from `@react-navigation/elements`
- `useAndroidImeDockOffset` from `@/hooks/useKeyboardHeight`

Do **not** add `SafeAreaView` or `useBottomChromeInset`; onboarding
`_layout.tsx` already owns the bottom safe area.

Keep the `Chip` import. Locality chips are removed, but `Chip` is still used
for existing community suggestions when `alreadyComplete` is true.

### 2. Add locality-picker and dock state

Alongside `countryOpen`, add:

```ts
const [localityOpen, setLocalityOpen] = useState(false);
```

Near the existing router / content-style values, add:

```ts
const headerHeight = useHeaderHeight();
const androidDockOffset = useAndroidImeDockOffset(0);
const footerContentStyle = useOnboardingContentStyle({
  includeVertical: false,
});
```

Why `0`: the onboarding layout already reserves the closed-state bottom safe
area. The hook only needs to add the Android IME height when the app window
does not resize.

In `resetArea()`, also call `setLocalityOpen(false)` so changing / clearing a
PIN cannot leave a stale area picker open.

### 3. Replace only the locality chip row

Keep the existing condition:

```ts
localityOptions.length > 0
```

Inside that branch:

1. Keep the current label and helper copy.
2. Replace `styles.chipRow` and the mapped locality `Chip` components with a
   `Pressable` using the existing `styles.dropdown`.
3. Display the selected option when
   `localityOptions.includes(locality)`; otherwise display “Select area”.
4. Show the existing `chevron-down` icon.
5. On press, call `setLocalityOpen(true)`.
6. Add `accessibilityRole="button"`,
   `accessibilityLabel="Choose locality or area"`, and
   `accessibilityState={{ expanded: localityOpen }}`.

Do not touch:

- the no-options free-text branch
- “Or type a different area”
- `canContinue`
- single-option auto-selection in the lookup effect
- city/state, community, save or analytics logic outside locality selection

### 4. Add the locality modal

Add a second `Modal` beside the existing Country modal, not inside the
scrollable form:

- `visible={localityOpen}`
- `animationType="slide"`
- `presentationStyle="pageSheet"`
- `onRequestClose={() => setLocalityOpen(false)}`
- title: “Select your area”
- data: `localityOptions`
- `keyExtractor={(option) => option}`

Reuse the existing modal header and row styles (`modal`, `modalHead`,
`modalTitle`, `modalClose`, `countryRow`, active-row styles). Renaming those
styles is optional and unnecessary for this scoped change.

When a row is selected:

1. `setLocality(option)`
2. `setLocalityOpen(false)`
3. `trackEvent("area_selected", { source: "dropdown" })`

Show the existing checkmark for the selected option. The Country modal remains
functionally unchanged.

### 5. Restructure the root layout

Change the root from a single `ScrollView` to:

```tsx
<KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
>
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={[styles.content, contentStyle]}
    keyboardShouldPersistTaps="handled"
  >
    {/* all existing fields, error and disabled hint */}
  </ScrollView>

  <View
    style={[
      styles.footerDock,
      androidDockOffset > 0
        ? { marginBottom: androidDockOffset }
        : null,
    ]}
  >
    <View style={footerContentStyle}>
      {/* existing PrimaryButton */}
      {/* existing OnboardingAccountSwitch */}
    </View>
  </View>

  {/* Country modal */}
  {/* Locality modal */}
</KeyboardAvoidingView>
```

The enclosing `SafeAreaView` remains the one in
`apps/mobile/app/onboarding/_layout.tsx`. Do not edit that file.

### 6. Move the button and account row together

Move these existing elements, unchanged, from the end of the `ScrollView` into
`footerDock`, preserving their order:

1. `PrimaryButton`
2. `{alreadyComplete ? null : <OnboardingAccountSwitch step="location" />}`

This keeps “Signed in as … · Not you?” directly below Continue as it is today.
For an already-onboarded user, the dock contains only “Save location”, matching
the current conditional behavior.

Leave `error` and the `!canContinue` hint where they currently are inside the
`ScrollView`; moving those would be an additional UX change.

### 7. Add only the required styles

Add:

```ts
scroll: { flex: 1 },
footerDock: {
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: colors.border,
  backgroundColor: colors.card,
  paddingTop: 6,
  paddingBottom: 6,
},
```

Keep `container: { flex: 1, backgroundColor: colors.bg }`, now applied to the
`KeyboardAvoidingView`. The centered `footerContentStyle` supplies the same
phone / tablet width and horizontal padding as the form.

No absolute positioning is needed. Because the scroll view has `flex: 1` and
the dock is its sibling, the dock occupies layout space and does not cover the
last scroll item.

### 8. Verify behavior

Static check:

```sh
npx tsc --noEmit -p apps/mobile/tsconfig.json
```

Manual checks on both iOS and Android:

1. **PIN incomplete:** Continue is visible, disabled, and the existing hint is
   still present.
2. **Single-locality PIN:** locality auto-selects; with number pad still open,
   Continue enables and is tappable above the keypad.
3. **Multi-locality PIN:** dropdown appears instead of chips; select one row;
   the selected name appears and Continue enables.
4. **Different-area field:** typing a custom area still works and enables
   Continue exactly as today.
5. **Lookup fails / unsupported country:** the existing free-text locality
   path remains unchanged.
6. **First-run account row:** “Signed in as … · Not you?” remains below
   Continue and opens the existing confirmation.
7. **Already complete:** button label remains “Save location”; account row
   remains hidden; community suggestions still render as chips.
8. **Android resize modes:** no keyboard-sized gap when the window resizes and
   no keypad overlap when it does not resize.
9. **Keyboard closed:** no doubled bottom safe-area gap.

No API, schema, shared-hook, or other-screen changes.

---

## Out of scope (explicit)

- Hiding / changing city or state fields
- Server-side location save behavior
- Community / apartment field
- Postal-name ranking / “More areas”
- 2G CDN / Redis / on-device PIN packs
- School, class, or child onboarding screens
- Extracting a shared sticky-footer component unless needed for this screen

---

## Success signal

- Parent can enter PIN and tap Continue **without dismissing the keypad**.
- Multi-locality PIN: pick area from dropdown; Continue stays on screen above
  the keypad.
- No other location-step behavior regressions.
