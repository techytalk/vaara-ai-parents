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
 * Android is the hard case: whether the app window shrinks when the keyboard
 * opens depends on the OS version *and* on whether the app opted out of
 * edge-to-edge enforcement, which cannot be derived from `Platform.Version`
 * alone. So the window behaviour is measured the first time the keyboard
 * opens, by comparing the window height against its keyboard-closed baseline.
 *
 * Heights come from `endCoordinates.height` only — never screen/window
 * arithmetic, which OEM skins report inconsistently.
 */

type ImeState = {
  height: number;
  /**
   * True when the window shrinks for the IME (`adjustResize` is in effect), so
   * a dock is already lifted and must not be offset again. `null` until the
   * keyboard has been opened at least once.
   */
  windowResizesForIme: boolean | null;
};

let subscribed = false;
let current: ImeState = { height: 0, windowResizesForIme: null };
let closedWindowHeight: number | null = null;
const subscribers = new Set<(state: ImeState) => void>();

function windowHeight(): number {
  return Dimensions.get("window").height;
}

function heightFromEvent(event: KeyboardEvent): number {
  return Math.max(0, Math.round(event.endCoordinates.height));
}

function publish(next: ImeState) {
  if (
    next.height === current.height &&
    next.windowResizesForIme === current.windowResizesForIme
  ) {
    return;
  }
  current = next;
  subscribers.forEach((listener) => listener(next));
}

function handleShow(height: number) {
  if (height <= 0) {
    publish({ ...current, height: 0 });
    return;
  }

  let resizes = current.windowResizesForIme;
  if (Platform.OS === "android" && closedWindowHeight != null) {
    // A window that resizes loses roughly the IME height. Half of it is a safe
    // threshold: well above measurement noise, well below a real resize.
    resizes = closedWindowHeight - windowHeight() >= height / 2;
  }

  publish({ height, windowResizesForIme: resizes });
}

function handleHide() {
  closedWindowHeight = windowHeight();
  publish({ ...current, height: 0 });
}

function ensureKeyboardSubscription() {
  if (subscribed) return;
  subscribed = true;

  closedWindowHeight = windowHeight();

  Dimensions.addEventListener("change", () => {
    // Tab bar hide in chat changes the closed baseline; keep it fresh.
    if (current.height === 0) {
      closedWindowHeight = windowHeight();
    }
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
      // Ignore junk frames; keep suggestion-bar growth (~IME height).
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
 * Space that must remain below an Android composer. Apply this as margin,
 * never padding: padding leaves children inside the IME-covered region.
 * Keyboard closed → nav/chrome inset. iOS callers get 0 and use KAV.
 */
export function useAndroidImeDockOffset(closedInset: number): number {
  const { height, windowResizesForIme } = useImeState();

  if (Platform.OS !== "android") return 0;

  const navInset = Math.max(closedInset, 0);
  if (height <= 0) return navInset;

  // Window already shrank for the IME, so the dock is lifted; offsetting again
  // would double-count and strand a keyboard-sized gap under the composer.
  if (windowResizesForIme !== false) return 0;

  return height + navInset;
}
