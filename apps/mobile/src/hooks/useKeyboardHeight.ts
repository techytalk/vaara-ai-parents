import { useLayoutEffect, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from "react-native";

/**
 * Shared IME state for composer docks (Post / Save / chat).
 *
 * Android: whether the window shrinks for the IME cannot be derived from
 * `Platform.Version` alone. Measure shrink against the keyboard-closed
 * baseline, then:
 *   - no resize → lift by the full IME height (Post / Save path)
 *   - resize    → lift only the uncovered remainder
 *
 * Gboard’s suggestion strip is the extra case: it often paints above the key
 * grid without growing `endCoordinates.height` or shrinking the window, so
 * the dock still needs a strip-sized lift.
 */

/** One Gboard / Samsung suggestion row. Better a small gap than a covered dock. */
const SUGGESTION_STRIP = 56;

type ImeState = {
  height: number;
  /** True when the window shrinks for the IME. Null until first open. */
  windowResizesForIme: boolean | null;
  windowShrink: number;
};

let subscribed = false;
let current: ImeState = {
  height: 0,
  windowResizesForIme: null,
  windowShrink: 0,
};
let closedWindowHeight: number | null = null;
let lastImeHeight = 0;
const subscribers = new Set<(state: ImeState) => void>();

function windowHeight(): number {
  return Dimensions.get("window").height;
}

function heightFromEvent(event: KeyboardEvent): number {
  return Math.max(0, Math.round(event.endCoordinates.height));
}

function measuredShrink(): number {
  if (closedWindowHeight == null) return 0;
  return Math.max(0, Math.round(closedWindowHeight - windowHeight()));
}

function publish(next: ImeState) {
  if (
    next.height === current.height &&
    next.windowResizesForIme === current.windowResizesForIme &&
    next.windowShrink === current.windowShrink
  ) {
    return;
  }
  current = next;
  subscribers.forEach((listener) => listener(next));
}

function handleShow(height: number) {
  if (height <= 0) return;

  lastImeHeight = height;
  const shrink = measuredShrink();
  let resizes = current.windowResizesForIme;
  if (Platform.OS === "android" && closedWindowHeight != null) {
    resizes = shrink >= height / 2;
  }

  publish({ height, windowResizesForIme: resizes, windowShrink: shrink });
}

function handleHide() {
  lastImeHeight = 0;
  closedWindowHeight = windowHeight();
  publish({
    height: 0,
    windowResizesForIme: current.windowResizesForIme,
    windowShrink: 0,
  });
}

function ensureKeyboardSubscription() {
  if (subscribed) return;
  subscribed = true;

  closedWindowHeight = windowHeight();

  Dimensions.addEventListener("change", () => {
    if (current.height === 0) {
      closedWindowHeight = windowHeight();
      return;
    }
    // Window resized while the IME is up (tab bar hide, adjustResize).
    if (lastImeHeight > 0) handleShow(lastImeHeight);
  });

  const showEvent =
    Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideEvent =
    Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

  Keyboard.addListener(showEvent, (event) => {
    handleShow(heightFromEvent(event));
  });
  Keyboard.addListener(hideEvent, handleHide);

  if (Platform.OS === "android") {
    Keyboard.addListener("keyboardDidChangeFrame", (event) => {
      const next = heightFromEvent(event);
      // Suggestion-bar growth is a real frame. Height 0 here is a junk frame —
      // treating it as hide drops the dock while Gboard is still open.
      if (next >= 80) handleShow(next);
    });
  }

  const metrics = Keyboard.metrics();
  if (metrics?.height) {
    handleShow(Math.round(metrics.height));
  }
}

function useImeState(): ImeState {
  const [state, setState] = useState(current);

  useLayoutEffect(() => {
    ensureKeyboardSubscription();
    setState(current);
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  return state;
}

export function useKeyboardHeight(): number {
  return useImeState().height;
}

/**
 * Space that must remain below an Android composer. Apply as margin, never
 * padding: padding leaves children inside the IME-covered region.
 * Keyboard closed → nav/chrome inset. iOS callers get 0 and use KAV.
 */
export function useAndroidImeDockOffset(closedInset: number): number {
  const { height, windowResizesForIme, windowShrink } = useImeState();

  if (Platform.OS !== "android") return 0;

  const navInset = Math.max(closedInset, 0);
  if (height <= 0) return navInset;

  // Window did not shrink: same lift as Post / Save, plus the suggestion strip
  // that Gboard paints above the reported key-grid height.
  if (windowResizesForIme === false) {
    return height + navInset + SUGGESTION_STRIP;
  }

  // Window already shrank for the key grid. Lift the leftover (strip growth)
  // and never less than one suggestion row.
  return Math.max(SUGGESTION_STRIP, height - windowShrink);
}
