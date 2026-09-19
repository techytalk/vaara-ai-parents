# Auth screens: fit to device (no vertical scroll)

**Status:** Implemented in mobile auth screens. OTA behaviour unchanged.  
**Scope:** `/(auth)/register` and `/(auth)/login` only.  
**Out of scope:** Onboarding after auth, OTA reload behaviour (leave as today).

Related code:

- [`apps/mobile/src/components/AuthScreenShell.tsx`](../apps/mobile/src/components/AuthScreenShell.tsx) — density bands + fixed layout
- [`apps/mobile/app/(auth)/register.tsx`](../apps/mobile/app/(auth)/register.tsx)
- [`apps/mobile/app/(auth)/login.tsx`](../apps/mobile/app/(auth)/login.tsx)
- [`apps/mobile/src/components/AuthHookHeadline.tsx`](../apps/mobile/src/components/AuthHookHeadline.tsx)
- [`apps/mobile/src/components/AuthPitchStrip.tsx`](../apps/mobile/src/components/AuthPitchStrip.tsx) — removed from auth; keep for other marketing surfaces if needed
- [`apps/mobile/app/(auth)/_layout.tsx`](../apps/mobile/app/(auth)/_layout.tsx)

---

## 1. Problem

Clarity sessions show parents **pulling the create-account / sign-in screens up and
down**. That is not a second signup route and not a bug in navigation.

Both screens wrap content in a `ScrollView`. Content is taller than a typical
phone viewport, so the page scrolls (and rubber-bands). The bottom of the pitch
strip is often cut off, which invites more scrolling.

Goals from product:

1. Keep the **current** signup / sign-in copy and CTAs (new headline, Continue
   with Google / email). Do **not** revert to the older “NEW TO VAARA / Create
   your parent account” layout.
2. Screens must **not scroll vertically** in the default social-CTA state.
3. Layout must **adapt to device height** (small phones → compact; tall phones /
   tablets → comfortable spacing), not use one fixed phone design that overflows.

OTA continues to apply updates on launch (`useOTAUpdates` unchanged). A future
store AAB/IPA is still required to stop the one-time flash of the *old* embedded
binary UI; that is separate from this layout work.

---

## 2. Decision: can we do non-scrollable auth?

**Yes**, if we treat the first viewport as a **fixed composition budget** and
drop or relocate anything that does not fit.

Non-negotiable on first paint (social / primary path):

| Keep | Why |
|------|-----|
| Logo | Brand |
| Short kicker + **one** headline (tightened if needed) | Product message |
| Apple (iOS) + Google | Primary conversion |
| Continue / Sign in with email | Fallback |
| Already have an account? / New to Vaara? | Cross-link |
| Legal one-liner | Compliance |

Must leave the first viewport (or become optional / secondary):

| Move or remove | Why it causes scroll today |
|----------------|----------------------------|
| `AuthPitchStrip` (image carousel) | ~104px+ plus margins; often half-visible → scroll bait |
| Long multi-line display headline (30/38) spanning 4–6 lines | Burns 120–200px before CTAs |
| Tall stack header + large vertical padding | Reduces usable height |
| Teacher / provider row on register | Useful, but below CTAs today; keep only if height budget allows |

**Email expanded form** (name + email + password + button) is taller. Rules:

- Default path (social buttons): **no vertical `ScrollView`**.
- Expanded email form on **small** phones: allow a **local** scroll *only for the
  form block* (or the whole screen) while keyboard is open; when keyboard is
  closed, prefer fitting without scroll if possible.
- Do not put the pitch carousel back above the fold.

---

## 3. Target composition (first viewport)

One column, top → bottom, inside safe area + stack header:

```text
┌─────────────────────────────────────┐
│  Stack title: Create account / Sign in │  ← keep; compact title
├─────────────────────────────────────┤
│  Logo (compact)                     │
│  Kicker (1 line)                    │
│  Headline (2–3 lines max on small)  │
│  [optional 1-line lead on tall only]│
│                                     │
│  [Continue with Apple]   iOS only   │
│  [Continue with Google]             │
│  [Continue / Sign in with email]    │
│                                     │
│  Already have an account? Sign in → │
│  [I'm a teacher…]  register only    │  ← omit on short screens if needed
│  Legal footer (2 lines max)         │
└─────────────────────────────────────┘
```

**No** pitch strip on these two routes after this change. Pitch content already
exists in intro / onboarding; repeating it under the CTAs is what forces scroll.

---

## 4. Device height budgets

Measure usable height as:

```text
usable =
  windowHeight
  − statusBar / safe top (header owns most of this)
  − stack header height
  − safe bottom inset
```

Use `useWindowDimensions().height` plus header / safe-area measurements (or
`useHeaderHeight()` from React Navigation + `useSafeAreaInsets()`).

### Bands (approximate; tune in implementation)

| Band | Usable height (approx.) | Density |
|------|-------------------------|---------|
| **Short** | &lt; 560 dp | Compact: smaller headline (`screenTitle` 24/31), less padding, hide provider row or move to “More options”, no lead under headline |
| **Regular** | 560–700 dp | Current spacing tokens, 2–3 line headline, provider row OK |
| **Tall / tablet** | &gt; 700 dp | Slightly more breathing room; optional one-line lead; still **no** pitch strip |

Horizontal layout stays as today: phone full width with 16px padding; tablet
`maxWidth: layout.formMaxWidth` centred (`useOnboardingContentStyle`).

---

## 5. Implementation rules

### 5.1 Replace `ScrollView` with a flex column

```text
SafeAreaView (edges: bottom, left, right — header handles top)
  └ KeyboardAvoidingView (iOS padding)
       └ View flex:1
            ├ View flex:1 (main — justifyContent: space-between OR flex-start with gap)
            │    logo + headline + social + email CTA
            └ View (footer — cross-link + optional provider + legal)
```

- `contentContainerStyle.flexGrow` / unbounded vertical lists: **remove**.
- `showsVerticalScrollIndicator`: N/A.
- Do **not** set `alwaysBounceVertical`; there should be no vertical scroll view
  in the default state.

### 5.2 Headline must fit a line budget

Today’s parent register headline is long (school + neighbourhood + opinions). On
**short** bands:

- Prefer **2 lines** of `screenTitle` (or capped `display` with
  `numberOfLines={3}` and slightly smaller size).
- Drop or shorten the lead; keep meaning in the headline.
- Login headline is shorter; still apply the same line cap for consistency.

Exact copy can stay; typography and `numberOfLines` adapt by band. If copy still
overflows at 3 lines on short devices, use a **short-band variant string** (same
intent, fewer words) — document the strings in the PR, do not invent a second
route.

### 5.3 Keyboard

- Social-only state: keyboard rarely open → no scroll needed.
- Email form open: wrap **only that form** (or the screen) in
  `KeyboardAvoidingView` + optional `ScrollView` with
  `keyboardShouldPersistTaps="handled"` **while `showEmail === true`**.
- Closing email (“Use Apple or Google instead”) returns to the non-scroll layout.

### 5.4 Provider / teacher switch (register only)

- **Regular / tall:** keep the teal row under the sign-in link.
- **Short:** replace with a text link (“I’m a teacher or school”) to save ~48px,
  or hide until after parent account exists (product call — default: compact
  text link).

Switching to provider still updates headline in place (same route). That is
**not** a second signup page.

### 5.5 Shared layout helper (recommended)

Add something like `AuthScreenShell` used by register + login:

- Computes `band: "short" | "regular" | "tall"`
- Applies padding / headline style / whether provider row is compact
- Owns non-scroll structure

Avoid duplicating density logic in two files.

---

## 6. Acceptance checklist

### Register — social state (default)

- [ ] No vertical scrolling / bounce on a short phone (e.g. iPhone SE-class /
      ~640–700 logical height window) and on a common Android (~720–800).
- [ ] Logo, headline, Google, email CTA, “Already have an account?”, legal all
      visible without scrolling.
- [ ] Pitch strip **not** present.
- [ ] Copy is the **current** product copy (Create your Vaara account / school &
      neighbourhood), not the retired “NEW TO VAARA / Create your parent account”
      screen.

### Login — social state

- [ ] Same non-scroll rule.
- [ ] “New to Vaara? Create an account →” visible without scrolling.

### Email expanded

- [ ] Fields usable with keyboard; if content exceeds viewport, scroll is limited
      to this mode only.
- [ ] Returning to social CTAs restores non-scroll layout.

### Density

- [ ] Short band: tighter type/spacing; no cut-off CTAs.
- [ ] Tall band: no large empty void that looks broken; still one composition,
      not a marketing feed.

### Regression

- [ ] Apple / Google / email auth still complete and route via `routeAfterAuth`.
- [ ] Parent ↔ provider toggle still works on register.
- [ ] OTA behaviour unchanged.

---

## 7. Delivery

1. Implement layout + optional `AuthScreenShell` per §5.
2. Manual QA on one short device and one regular device (iOS + Android if
   available).
3. Ship **production OTA** (runtime `1.0.3`) so installs already on the new signup
   copy also get the fit layout.
4. Include the same JS in the **next store AAB/IPA** so cold start matches OTA
   (avoids old-binary flash; separate from scroll work).

---

## 8. Explicit non-goals

- Changing OTA `reloadAsync()` on launch.
- Bringing back the retired signup marketing copy as a second route.
- Making onboarding screens non-scrollable in this pass.
- In-app video or heavy illustration on auth.

---

## 9. Summary

| Question | Answer |
|----------|--------|
| Can signup/signin be non-scrollable? | Yes |
| How? | Fixed flex layout + height bands; remove pitch strip from auth; tighten headline on short devices; scroll only for email+keyboard if needed |
| Keep new signup page? | Yes — current copy stays; only layout density changes |
| Need new AAB for non-scroll? | OTA can ship the layout; AAB still recommended so cold start = new UI without old flash |
