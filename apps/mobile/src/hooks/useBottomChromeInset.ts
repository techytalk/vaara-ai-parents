import { useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  StatusBar,
  type ScaledSize,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Measure the system UI that sits below the app window on Android
 * (3-button nav or gesture hint). This is device-specific and updates on
 * rotation / foldable posture changes. Returns 0 when the window is already
 * edge-to-edge (gap is 0) — then safe-area insets should be used instead.
 */
function measureSystemBottomInset(
  screen: ScaledSize = Dimensions.get("screen"),
  window: ScaledSize = Dimensions.get("window")
): number {
  if (Platform.OS !== "android") return 0;

  let gap = screen.height - window.height;
  if (gap <= 0) return 0;

  // Some devices include the status bar in the screen−window gap.
  const status = StatusBar.currentHeight ?? 0;
  if (gap > 56 && status > 0) {
    gap = Math.max(0, gap - status);
  }

  // Ignore nonsense values (split-screen / unusual OEM metrics).
  if (gap <= 0 || gap > 80) return 0;
  return Math.round(gap);
}

/**
 * Bottom inset that clears the iPhone home indicator / Android system nav on
 * every device. Combines:
 * 1. Safe-area inset from the OS (correct on iOS; often correct on Android)
 * 2. Live screen−window measurement on Android when OEMs under-report (1)
 *
 * Always prefers the larger of the two so icons never sit under system chrome.
 */
export function useBottomChromeInset(): number {
  const insets = useSafeAreaInsets();
  const [measured, setMeasured] = useState(() => measureSystemBottomInset());

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sync = ({
      screen,
      window,
    }: {
      screen: ScaledSize;
      window: ScaledSize;
    }) => {
      setMeasured(measureSystemBottomInset(screen, window));
    };

    sync({
      screen: Dimensions.get("screen"),
      window: Dimensions.get("window"),
    });

    const sub = Dimensions.addEventListener("change", sync);
    return () => sub.remove();
  }, []);

  if (Platform.OS === "ios") {
    // Home-indicator phones report 20–34; older phones report 0 — keep a
    // small pad so labels aren't flush with the physical edge.
    return Math.max(insets.bottom, 8);
  }

  return Math.max(insets.bottom, measured);
}
