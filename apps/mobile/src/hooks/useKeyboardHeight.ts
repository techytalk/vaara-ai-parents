import { useLayoutEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";

/**
 * Shared IME height. Android 15 edge-to-edge does not shrink the window
 * (`adjustResize` is a no-op); composers must pad by this value instead.
 *
 * Uses `endCoordinates.height` only — not screen/window arithmetic.
 */
let subscribed = false;
let currentHeight = 0;
const subscribers = new Set<(height: number) => void>();

/**
 * Android 15 enforces edge-to-edge for targetSdk 35: the window never resizes
 * for the IME, and the keyboard height RN reports stops at the visible view
 * area, i.e. above the navigation bar, so that strip has to be added back.
 */
const ANDROID_EDGE_TO_EDGE =
  Platform.OS === "android" && Number(Platform.Version) >= 35;

function heightFromEvent(event: KeyboardEvent): number {
  return Math.max(0, Math.round(event.endCoordinates.height));
}

function publish(next: number) {
  if (next === currentHeight) return;
  currentHeight = next;
  subscribers.forEach((listener) => listener(next));
}

function ensureKeyboardSubscription() {
  if (subscribed) return;
  subscribed = true;

  const showEvent =
    Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideEvent =
    Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

  Keyboard.addListener(showEvent, (event) => {
    publish(heightFromEvent(event));
  });
  Keyboard.addListener(hideEvent, () => {
    publish(0);
  });
  if (Platform.OS === "android") {
    Keyboard.addListener("keyboardDidChangeFrame", (event) => {
      const next = heightFromEvent(event);
      // Ignore junk frames; keep suggestion-bar growth (~IME height).
      if (next === 0 || next >= 80) publish(next);
    });
  }

  const metrics = Keyboard.metrics();
  if (metrics?.height) {
    publish(Math.round(metrics.height));
  }
}

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(currentHeight);

  useLayoutEffect(() => {
    ensureKeyboardSubscription();
    setHeight(currentHeight);
    subscribers.add(setHeight);
    return () => {
      subscribers.delete(setHeight);
    };
  }, []);

  return height;
}

/**
 * Space that must remain below an Android composer. Apply this as margin,
 * never padding: padding leaves children inside the IME-covered region.
 * Keyboard closed → nav/chrome inset. iOS callers return 0 and use KAV.
 */
export function androidImeDockOffset(
  keyboardHeight: number,
  closedInset: number
): number {
  if (Platform.OS !== "android") return 0;
  const navInset = Math.max(closedInset, 0);
  if (keyboardHeight <= 0) return navInset;
  // Below API 35 the window still resizes, so the composer is already lifted.
  return ANDROID_EDGE_TO_EDGE ? keyboardHeight + navInset : 0;
}
