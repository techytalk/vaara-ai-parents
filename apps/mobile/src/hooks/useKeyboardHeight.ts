import { useLayoutEffect, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from "react-native";

/**
 * Shared IME state for composer docks.
 *
 * Android is the hard case: whether the app window shrinks when the keyboard
 * opens depends on the OS version *and* on whether the app opted out of
 * edge-to-edge enforcement, which cannot be derived from `Platform.Version`
 * alone. We measure the shrink once against the keyboard-closed baseline, then
 * lift the dock by only the uncovered remainder.
 *
 * That remainder matters for Gboard's suggestion bar: the window often resizes
 * for the key grid, then the suggestion strip grows on top without a further
 * window shrink — leaving Post / Save / chat composers half-covered.
 *
 * Heights come from `endCoordinates.height` only — never screen/window
 * arithmetic for the IME itself, which OEM skins report inconsistently.
 */

type ImeState = {
  height: number;
  /** How many px the window height fell since the keyboard-closed baseline. */
  windowShrink: number;
};

let subscribed = false;
let current: ImeState = { height: 0, windowShrink: 0 };
let closedWindowHeight: number | null = null;
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
    next.windowShrink === current.windowShrink
  ) {
    return;
  }
  current = next;
  subscribers.forEach((listener) => listener(next));
}

function handleShow(height: number) {
  if (height <= 0) {
    publish({ height: 0, windowShrink: 0 });
    return;
  }

  publish({ height, windowShrink: measuredShrink() });
}

function handleHide() {
  closedWindowHeight = windowHeight();
  publish({ height: 0, windowShrink: 0 });
}

function ensureKeyboardSubscription() {
  if (subscribed) return;
  subscribed = true;

  closedWindowHeight = windowHeight();

  Dimensions.addEventListener("change", () => {
    // Keep the closed baseline fresh when layout changes (e.g. tab bar
    // hidden in chat) so the next keyboard open measures shrink correctly.
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
      if (next === 0 || next >= 80) handleShow(next);
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
 *
 * When the keyboard is open, returns only the part of the IME the window
 * resize did not already clear — so suggestion-bar growth still lifts the
 * dock even if adjustResize already handled the key grid.
 */
export function useAndroidImeDockOffset(closedInset: number): number {
  const { height, windowShrink } = useImeState();

  if (Platform.OS !== "android") return 0;

  const navInset = Math.max(closedInset, 0);
  if (height <= 0) return navInset;

  return Math.max(0, height - windowShrink);
}
