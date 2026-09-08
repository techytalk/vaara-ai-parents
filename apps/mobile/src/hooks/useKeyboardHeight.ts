import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Distance from the physical bottom of the screen to the top of the keyboard.
 * Use this to pin composer docks above the keyboard. When 0, the keyboard is
 * closed — callers should fall back to the safe-area bottom inset instead.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return height;
}

/**
 * Bottom padding for a docked composer toolbar / reply bar / message input.
 * Keyboard open → sit just above the keyboard. Closed → device safe area.
 */
export function composerDockPadding(
  keyboardHeight: number,
  safeBottom: number,
  gap = 10
): number {
  if (keyboardHeight > 0) {
    return keyboardHeight + gap;
  }
  return Math.max(safeBottom, gap);
}
