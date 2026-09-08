# Android composer keyboard remediation

## Purpose

This document describes how to fix the intermittent Post/Save button overlap
seen on Android when the keyboard opens. It covers New Post, Edit Post, post
replies, and direct messages.

The visible failure has two forms:

- First open: the Post/Save button is only partly above the keyboard.
- A later open: the toolbar remains visible, but the Post/Save button is fully
  behind the keyboard.

This is not primarily a button-height problem. The app currently combines
Android window panning with JavaScript keyboard-height padding. Those two
systems do not share a reliable source of truth, especially during an
auto-focused screen transition.

## Current state

Implemented in source per this remediation plan:

- Android `softwareKeyboardLayoutMode: "resize"` / `adjustResize`
- Composer screens use `SafeAreaView` (stack routes) + iOS `KeyboardAvoidingView`
- Manual `useKeyboardHeight` / `composerDockPadding` removed
- New Post defers focus with `InteractionManager` instead of mount-time `autoFocus`

A new Android APK is required for `adjustResize` to take effect on devices that
still have an `adjustPan` binary.

## Current state (historical)

The APK built before this diagnosis contains `adjustPan`. Earlier work-in-progress
contained unshipped keyboard-height heuristics that this plan explicitly rejects.

## Selected design

Use one owner for each kind of movement:

1. Android `adjustResize` owns keyboard movement on Android.
2. `KeyboardAvoidingView` owns keyboard movement on iOS.
3. `SafeAreaView` owns physical bottom insets.
4. React Navigation owns tab-bar and native-header geometry.
5. Composer rows remain normal-flow siblings below their scrollable content.

Do not add raw keyboard height to a composer on Android when `adjustResize` is
active. When the IME opens, Android reduces the root content viewport. A
normal-flow composer at the bottom of a `flex: 1` layout then moves above the
keyboard automatically.

## The seven gaps and their fixes

### 1. Two keyboard strategies are mixed

#### Gap

The installed APK uses `adjustPan`, while React code adds
`keyboardHeight + gap` as bottom padding. Android pans only enough to expose
the focused `TextInput`; it does not guarantee that controls below that input
are visible. JavaScript then tries to compensate for an unknown pan distance.

This produces the observed toolbar-visible/button-hidden state.

#### Fix

Adopt `adjustResize` and remove Android keyboard-height padding:

```json
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "resize"
    }
  }
}
```

The generated native activity must contain:

```xml
android:windowSoftInputMode="adjustResize"
```

Because this is native Android configuration, it requires a new APK/AAB.
An OTA update cannot convert an already-installed `adjustPan` binary into an
`adjustResize` binary.

### 2. The screen/window shrink heuristic is unreliable

#### Gap

The work-in-progress helper checks:

```ts
Dimensions.get("screen").height - Dimensions.get("window").height
```

and guesses whether Android has already resized. That difference can include
the status bar, navigation controls, cutouts, split-screen bounds, or OEM
window behavior. It is not a dependable boolean for “the keyboard has already
been applied.”

A false positive returns only a small gap while the keyboard still overlays
the app. A false negative adds the full keyboard height after Android has
already resized, creating a large blank area.

#### Fix

Delete the heuristic. The configured platform policy is explicit:

```ts
const behavior = Platform.OS === "ios" ? "padding" : undefined;
```

On Android, layout follows the resized root viewport. On iOS,
`KeyboardAvoidingView` applies the keyboard movement.

### 3. `screenY` and window-height arithmetic mix coordinate spaces

#### Gap

The work-in-progress helper calculates:

```ts
Dimensions.get("window").height - event.endCoordinates.screenY
```

`screenY` is expressed in screen coordinates, while `window.height` describes
the application window. Status bars, navigation bars, edge-to-edge mode, and
OEM insets can move their origins. Subtracting them can undercount or
overcount the keyboard.

#### Fix

Do not calculate the keyboard height for these screens. Remove
`useKeyboardHeight()` and `composerDockPadding()` from:

- `app/circles/[circleId]/new-post.tsx`
- `app/circles/[circleId]/posts/[postId].tsx`
- `app/(app)/messages/[conversationId].tsx`

Once no consumers remain, delete `src/hooks/useKeyboardHeight.ts`.

### 4. `adjustResize` must be verified with Android 15 and edge-to-edge

#### Gap

Android 15 edge-to-edge behavior can alter how IME insets are delivered.
Assuming that `adjustResize` works without testing would replace one guess with
another.

Vaara currently uses Expo 52 / React Native 0.76 and does not explicitly enable
edge-to-edge in app configuration. For this current configuration,
`adjustResize` is the simplest correct policy, but it still needs real-device
verification.

#### Fix

After generating the native project:

1. Confirm `MainActivity` resolves to `adjustResize`.
2. Build a preview APK; do not test this only through Expo Go.
3. Test on the affected phone and an Android 15 phone.
4. Test gesture navigation and three-button navigation.
5. While the keyboard is open, confirm the root view height decreases and the
   composer stays in normal flow.

If a future edge-to-edge migration prevents reliable resize, do not restore
screen/window arithmetic. Use `react-native-keyboard-controller` with one
root `KeyboardProvider` and `KeyboardStickyView` for composer rows. That is a
separate native migration and should replace, not supplement, the current
strategy.

### 5. One shared helper affects three different screen geometries

#### Gap

The same padding helper currently serves:

- New Post/Edit Post in a root stack.
- Post thread in a root stack.
- Messages inside a tab navigator.

Their closed-state bottom ownership differs. A numerical helper cannot safely
infer whether the stack, tab bar, or safe area has already reserved space.

#### Fix

Use the same structural rule but let each navigator own its geometry.

#### New Post and Edit Post

Use an outer bottom-safe area, then a platform-specific
`KeyboardAvoidingView`. Keep the body scrollable and composer in normal flow:

```tsx
const headerHeight = useHeaderHeight();

return (
  <SafeAreaView style={styles.safe} edges={["bottom"]}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <View style={styles.metaBar}>{/* audience and type */}</View>
      <ScrollView style={styles.body}>{/* post fields */}</ScrollView>
      <View style={styles.composerDock}>{/* toolbar and Post/Save */}</View>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

Remove dynamic `paddingBottom: dockPadBottom`. The safe-area wrapper owns the
closed-state inset; Android resize or iOS KAV owns the open-state movement.

#### Post thread

Use the same wrapper. Ensure the comments list has `flex: 1`, and keep the
reply composer below it:

```tsx
<SafeAreaView style={styles.safe} edges={["bottom"]}>
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
  >
    <FlatList style={styles.list} />
    <View style={styles.composer}>{/* reply input */}</View>
  </KeyboardAvoidingView>
</SafeAreaView>
```

Apply the same structure to the read-only composer so it is not covered by
system navigation.

#### Messages

Messages lives inside parent tabs. The tab navigator already reserves the tab
bar while closed and hides it while the keyboard is open. Do not add tab-bar
height manually.

Keep the message list `flex: 1`, keep the input row in normal flow, use iOS KAV,
and rely on Android resize. Verify that `tabBarHideOnKeyboard` remains enabled.

### 6. The keyboard can change height after opening

#### Gap

Gboard can add or remove suggestions, voice controls, emoji panels, or
handwriting UI after the first show event. A listener that records only the
initial `keyboardDidShow` height can become stale.

#### Fix

With the selected architecture, Android sends new IME insets and re-lays out
the root viewport. No component caches the first keyboard height. On iOS,
`KeyboardAvoidingView` responds to frame changes.

Acceptance tests must include:

- Suggestions enabled and disabled.
- Switching letters ↔ emoji.
- Voice input panel.
- Changing focus from post body to poll options.
- Changing keyboard orientation is unnecessary because Vaara is portrait-only,
  but changing keyboard mode must not cover the composer.

If any Android keyboard changes overlay rather than resize on a supported
device, capture the device/API/keyboard combination before selecting the
keyboard-controller fallback described in point 4.

### 7. `autoFocus` creates a mount-time event race

#### Gap

The post body currently uses `autoFocus`. During navigation, the keyboard can
start opening before screen-level keyboard listeners subscribe. That explains
why repeated opens can produce different cached heights.

#### Fix

Removing screen-level height listeners eliminates the correctness dependency
on event ordering. For smoother transitions, also replace direct `autoFocus`
with one deferred focus after navigation layout:

```tsx
const inputRef = useRef<TextInput>(null);
const didFocus = useRef(false);

useEffect(() => {
  if (isEditing || didFocus.current) return;
  didFocus.current = true;

  const task = InteractionManager.runAfterInteractions(() => {
    inputRef.current?.focus();
  });
  return () => task.cancel();
}, [isEditing]);
```

Then:

```tsx
<TextInput ref={inputRef} autoFocus={false} />
```

The `didFocus` guard prevents duplicate focus during re-renders. Do not
automatically refocus after the user dismisses the keyboard.

## Step-by-step implementation sequence

### Step 1: Record a reproducible baseline

On the affected phone, record:

1. Device model and Android version.
2. Keyboard name/version.
3. Gesture or three-button navigation.
4. First and second New Post openings.
5. Edit Post, post reply, and direct message behavior.

Keep screenshots showing the keyboard, toolbar, Post/Save button, and system
navigation together.

### Step 2: Remove manual keyboard geometry

In all three composer screens:

1. Remove `useKeyboardHeight` imports.
2. Remove `composerDockPadding` imports.
3. Remove `keyboardHeight` and `dockPadBottom`.
4. Remove dynamic composer `paddingBottom`.
5. Keep composer rows as normal-flow children—not absolute-positioned.

Delete the hook after confirming it has no remaining consumers.

### Step 3: Add safe-area and iOS ownership

For root-stack composer screens:

1. Import `SafeAreaView` from `react-native-safe-area-context`.
2. Import `KeyboardAvoidingView` and `Platform` from React Native.
3. Import `useHeaderHeight` from `@react-navigation/elements`.
4. Add bottom-only `SafeAreaView`.
5. Add iOS-only `KeyboardAvoidingView`.
6. Confirm both wrapper styles use `flex: 1`.

For messages, account for its tab navigator and avoid duplicating tab space.

### Step 4: Defer New Post focus

Replace `autoFocus={!isEditing}` with the guarded
`InteractionManager.runAfterInteractions` pattern in point 7. Test opening and
closing the route repeatedly.

### Step 5: Make Android resize authoritative

1. Keep `"softwareKeyboardLayoutMode": "resize"` in `app.json`.
2. Run the configured clean Android prebuild.
3. Inspect the generated manifest for `adjustResize`.
4. Do not manually change only the generated manifest and assume future clean
   prebuilds will preserve it; app configuration is the source of truth.

### Step 6: Validate locally

Run TypeScript and lint checks. Then verify:

- Post/Save is fully visible on the first open.
- Post/Save is fully visible after 10 repeated opens.
- No keyboard-sized blank gap appears.
- Closing the keyboard restores the correct system-navigation clearance.
- Poll and media layouts remain scrollable.
- Reply and message composers stay directly above the keyboard.
- The last list item can scroll above its composer.

### Step 7: Build a preview APK

This fix includes `adjustResize`, so build a new APK. An OTA-only test is not
sufficient for the affected installed binary.

Install the preview APK fresh on the affected device. Repeat the full
verification matrix before publishing production.

### Step 8: Roll out safely

1. Commit the verified layout and native config together.
2. Build the production APK/AAB.
3. Smoke-test post creation, edit, reply, and messages.
4. Publish production only after those flows pass.
5. Keep the previous APK available for rollback.

## Acceptance criteria

The fix is complete only when all are true:

- Post and Save remain fully visible above every tested keyboard state.
- Behavior is identical on first and repeated route opens.
- There is no full-keyboard-height blank space above the IME.
- Android gesture and three-button navigation both clear the composer.
- iOS remains correct with and without a home indicator.
- Font scaling up to 200% does not make the button unreachable.
- No composer calculates keyboard position using `Dimensions` or `screenY`.
- New Post, Edit Post, replies, and messages all follow the same ownership
  model.

## Rollback rule

If preview testing fails on Android 15, revert the preview binary rather than
adding another heuristic. Collect device-specific evidence and evaluate the
native `react-native-keyboard-controller` fallback as a deliberate replacement.
