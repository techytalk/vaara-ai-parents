# Mobile bottom insets and keyboard fixes

> Superseded for composer keyboard behavior. The current diagnosis and
> seven-point remediation plan are in
> [`ANDROID_COMPOSER_KEYBOARD_REMEDIATION.md`](./ANDROID_COMPOSER_KEYBOARD_REMEDIATION.md).
> This older document is retained as historical context and should not be used
> as the implementation checklist.

## Status

Implemented in the mobile app (New Post, Post thread, Messages, Provider tabs).
FAB positions remain relative to tab content (`bottom: spacing.lg`).

## Problem

Some bottom actions are covered by the Android navigation area or keyboard:

- New Post: the toolbar is visible, but the Post button is partially hidden.
- Post thread: the comment input and send button overlap the phone navigation area.

These routes are in the root `circles` stack, not the parent tab navigator:

- `app/circles/[circleId]/new-post.tsx`
- `app/circles/[circleId]/posts/[postId].tsx`

The collision shown in screenshots is therefore with the system navigation area
and keyboard, not with Vaara's five-item bottom tab bar.

## Current navigation structure

```text
app/_layout.tsx
├── (app)/_layout.tsx       Parent Tabs
├── (provider)/_layout.tsx  Provider Tabs
├── circles/_layout.tsx     Root Stack; no tab bar
├── onboarding
├── (auth)
└── (intro)
```

### Parent routes with the bottom tab bar

The following routes live under `(app)` and inherit the parent tab bar:

- Feed
- Circles
- Messages, new conversation, and conversation thread
- Discover/Activities and activity details
- More/Profile
- Schools, school details, and school review
- Notifications
- Marketplace, listing details, create listing, and my listings
- Reminders
- Saved Posts
- Your Posts
- Contact Details
- Topics and topic details
- Calendar and new calendar entry
- Practitioners and practitioner details
- Experts and expert details
- Playdates
- Carpool and arrangement details
- Settings, avatar, and notification settings
- Support

The tab bar already consumes the device bottom inset:

```ts
tabBarStyle: tabBarStyleForInsets(insets.bottom)
```

It also has `tabBarHideOnKeyboard: true`.

### Provider routes with the bottom tab bar

- Dashboard
- Activities, activity details, and new activity
- Profile

The provider tab bar uses the device bottom inset but does not currently set
`tabBarHideOnKeyboard`.

## Root causes

### 1. New Post uses two competing Android keyboard strategies

Android already declares:

```xml
android:windowSoftInputMode="adjustResize"
```

That causes the operating system to reduce the app viewport when the keyboard
opens. `new-post.tsx` also listens for keyboard events and applies the reported
keyboard height:

```ts
marginBottom: keyboardHeight
```

This counts the keyboard twice. The resized viewport has less room, and the
additional margin can push or clip the submit button.

The screen also discards the real bottom inset while the keyboard is open:

```ts
const composerPadBottom =
  keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10);
```

Finally, the screen root is a plain `View`, so only this manually calculated
footer padding protects it from the phone navigation area.

### 2. Post thread does not apply a bottom safe-area inset

The thread composer uses fixed padding:

```ts
composer: {
  padding: 10,
}
```

It does not use `SafeAreaView` or `insets.bottom`. On devices with a gesture
indicator or three-button navigation, the composer can extend under the system
UI.

Its `KeyboardAvoidingView` is active only on iOS:

```tsx
behavior={Platform.OS === "ios" ? "padding" : undefined}
```

Android consequently depends entirely on `adjustResize`. The `FlatList` also
lacks `flex: 1`, allowing the list and composer to compete for height on small
or keyboard-reduced viewports.

### 3. Several related screens repeat part of the pattern

- Message conversation: Android keyboard avoidance is undefined and the input
  row has no explicit safe-area protection.
- Provider tabs: tab bar remains visible when the keyboard opens.
- Feed and Circles: floating Post buttons use a fixed `bottom` value instead of
  deriving their position from safe-area/tab-bar geometry.
- Onboarding children: the footer is safe-area protected, but it is not
  keyboard-aware if inputs are later added to the same page.

## Implementation rules

Use one owner for each type of spacing:

1. `react-native-safe-area-context` owns physical screen insets.
2. Android `adjustResize` owns Android keyboard resizing.
3. `KeyboardAvoidingView` owns iOS keyboard movement.
4. React Navigation owns tab-bar space for routes inside a Tabs navigator.
5. A page must not add the raw keyboard height when `adjustResize` is enabled.

Avoid:

- Hard-coded bottom values intended to represent a home indicator.
- `marginBottom: keyboardHeight` on Android.
- A hard-coded keyboard offset such as `90` when a stack header is present.
- Applying both a full-screen bottom `SafeAreaView` and the same
  `insets.bottom` to the footer; that double-counts the safe area.

## Fix 1: New Post

File: `apps/mobile/app/circles/[circleId]/new-post.tsx`

### Changes

1. Remove `Keyboard` and the `keyboardHeight` state.
2. Remove keyboard show/hide listeners.
3. Remove `composerPadBottom`.
4. Remove `marginBottom: keyboardHeight`.
5. Wrap the content in a bottom-safe `SafeAreaView`.
6. Use `KeyboardAvoidingView` only for iOS.
7. Get the real stack header height with `useHeaderHeight()` rather than a
   constant.
8. Keep the composer in normal flex flow; do not make it absolute.

Target structure:

```tsx
const headerHeight = useHeaderHeight();

return (
  <SafeAreaView style={styles.safe} edges={["bottom"]}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <View style={styles.metaBar}>{/* ... */}</View>
      <ScrollView style={styles.body}>{/* ... */}</ScrollView>
      <View style={styles.composerDock}>{/* toolbar + Post */}</View>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

On Android, `adjustResize` will shrink this layout. On iOS, the
`KeyboardAvoidingView` will move the footer above the keyboard.

## Fix 2: Post thread comments

File: `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`

### Changes

1. Wrap the screen in `SafeAreaView` with `edges={["bottom"]}`.
2. Keep `KeyboardAvoidingView`, but use the measured stack header height on
   iOS.
3. Add `style={styles.list}` with `flex: 1` to the `FlatList`.
4. Keep the composer as a normal-flow sibling below the list.
5. Do not add `insets.bottom` to the composer if the outer `SafeAreaView`
   already owns the bottom inset.
6. Increase list content bottom padding only for visual spacing; the composer
   is a sibling, so its full height should not be duplicated in list padding.

Target structure:

```tsx
<SafeAreaView style={styles.safe} edges={["bottom"]}>
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
  >
    <FlatList style={styles.list} contentContainerStyle={styles.listContent} />
    <View style={styles.composer}>{/* comment input + send */}</View>
  </KeyboardAvoidingView>
</SafeAreaView>
```

Required styles:

```ts
safe: { flex: 1, backgroundColor: theme.bg },
container: { flex: 1, backgroundColor: theme.bg },
list: { flex: 1 },
```

## Fix 3: Message conversation

File: `apps/mobile/app/(app)/messages/[conversationId].tsx`

This route is inside the parent tab navigator. React Navigation already
reserves tab-bar space while the keyboard is closed and hides the tab bar while
the keyboard is open.

Apply the same layout discipline:

1. Ensure the message `FlatList` has `flex: 1`.
2. Keep the input row in normal flow.
3. Use a measured header offset for iOS.
4. Continue relying on `adjustResize` on Android.
5. Do not add the tab bar height manually.

## Fix 4: Provider tabs

File: `apps/mobile/app/(provider)/_layout.tsx`

Add:

```ts
tabBarHideOnKeyboard: true
```

This makes provider behavior consistent with parent tabs and prevents the
keyboard and tab bar from competing for vertical space.

## Fix 5: Feed and Circles Post buttons

Files:

- `apps/mobile/app/(app)/index.tsx`
- `apps/mobile/app/(app)/circles/index.tsx`

These FABs are inside the tab content area, so React Navigation already places
their containing screen above the tab bar. Do not add the tab-bar height.

Recommended changes:

1. Keep their position relative to the tab content area.
2. Use `Math.max(insets.bottom, spacing.lg)` only if testing shows that the
   navigator content extends beneath system UI.
3. Keep list bottom padding at least the FAB height plus visual spacing.
4. Confirm that the FAB does not cover the final list card at large font sizes.

## Reusable component recommendation

After the two critical screens are stable, introduce a reusable
`KeyboardSafeScreen` rather than copying keyboard logic:

```tsx
type KeyboardSafeScreenProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  includeBottomInset?: boolean;
};
```

It should:

- Render a `SafeAreaView`.
- Use `useHeaderHeight()`.
- Apply `KeyboardAvoidingView` padding only on iOS.
- Never subscribe to raw keyboard height on Android.
- Document whether the wrapper or child footer owns the bottom inset.

Do not introduce the abstraction before fixing and testing New Post and Post
Thread individually; otherwise the abstraction can hide incorrect assumptions.

## Verification matrix

Test on real devices where possible.

### Devices and navigation modes

- Small Android screen with three-button navigation.
- Android with gesture navigation.
- Tall Android device.
- iPhone with home indicator.
- iPhone SE-sized screen if available.

### Keyboards

- Gboard.
- Samsung Keyboard where available.
- iOS keyboard.
- Keyboard suggestion row enabled and disabled.

### New Post acceptance

- Post button is fully visible with keyboard closed.
- Post button is fully visible immediately after keyboard opens.
- Switching text → poll option does not jump or clip the footer.
- Adding media and scrolling keeps the focused field visible.
- Rotating is not required because the app is portrait-only.
- Closing the keyboard returns the footer to the correct safe-area position.
- Three-button Android navigation never covers the Post button.

### Post thread acceptance

- Comment input and send button are fully visible with keyboard closed.
- Composer moves above the keyboard without leaving a keyboard-sized blank gap.
- Last comment can be scrolled fully above the composer.
- Multiline comments grow to their maximum height without pushing the send
  button off-screen.
- Read-only footer is fully visible above system navigation.

### Message acceptance

- Tab bar is visible with keyboard closed.
- Tab bar hides with keyboard open.
- Input row remains directly above the keyboard.
- Latest message can be scrolled above the input row.

### Accessibility and responsive checks

- Test system font scale at 100%, 130%, and 200%.
- Touch targets remain at least 44 points.
- Buttons do not depend on fixed screen height.
- No footer uses raw screen dimensions to estimate keyboard height.
- Screen reader focus can reach the footer controls.

## Rollout

These changes are JavaScript/layout changes and can be delivered through the
existing production OTA channel because `adjustResize` is already present in
the Android native manifest.

Recommended order:

1. Implement New Post and Post Thread.
2. Verify on Android gesture and three-button navigation.
3. Implement Message conversation and Provider tabs.
4. Verify Feed/Circles FAB clearance.
5. Run TypeScript/lint checks.
6. Publish to a preview OTA channel first.
7. Promote the tested update to the production OTA channel.

Do not publish an OTA update until the runtime version matches the installed
binary and both post creation and commenting are verified end to end.
