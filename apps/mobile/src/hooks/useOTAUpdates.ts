import { useEffect } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";

/**
 * Downloads EAS Update JS bundles and applies them on launch.
 * Resume only prefetches so we don't reload mid-session (e.g. while composing).
 */
export function useOTAUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    async function sync(applyNow: boolean) {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled && applyNow) {
          await Updates.reloadAsync();
        }
      } catch {
        // Offline, Expo Go, or a binary without a matching runtime.
      }
    }

    void sync(true);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync(false);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
