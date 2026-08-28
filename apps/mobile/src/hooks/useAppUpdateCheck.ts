import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { isVersionLessThan } from "@/lib/version";

type UpdateState = {
  visible: boolean;
  forced: boolean;
  latestVersion?: string;
  openStore: () => void;
  dismiss: () => void;
};

function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

function getFallbackStoreUrl(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { iosStoreUrl?: string; androidStoreUrl?: string }
    | undefined;

  if (Platform.OS === "ios") {
    return extra?.iosStoreUrl ?? null;
  }
  if (Platform.OS === "android") {
    return (
      extra?.androidStoreUrl ??
      "https://play.google.com/store/apps/details?id=com.vaara.parents"
    );
  }
  return null;
}

export function useAppUpdateCheck(): UpdateState {
  const [visible, setVisible] = useState(false);
  const [forced, setForced] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | undefined>();
  const storeUrlRef = useRef<string | null>(getFallbackStoreUrl());
  const dismissedRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (dismissedRef.current) return;

    const current = getCurrentVersion();
    try {
      const info = await api.getAppVersion();
      storeUrlRef.current =
        Platform.OS === "ios"
          ? info.iosStoreUrl
          : info.androidStoreUrl ?? storeUrlRef.current;

      const needsUpdate = isVersionLessThan(current, info.latestVersion);
      const mustUpdate = isVersionLessThan(current, info.minimumVersion);

      if (mustUpdate) {
        setLatestVersion(info.latestVersion);
        setForced(true);
        setVisible(true);
        return;
      }

      if (needsUpdate) {
        setLatestVersion(info.latestVersion);
        setForced(false);
        setVisible(true);
      }
    } catch {
      // Offline or API unavailable — skip prompt
    }
  }, []);

  useEffect(() => {
    evaluate();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        evaluate();
      }
    });

    return () => subscription.remove();
  }, [evaluate]);

  const openStore = useCallback(() => {
    const url = storeUrlRef.current;
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  }, []);

  const dismiss = useCallback(() => {
    if (forced) return;
    dismissedRef.current = true;
    setVisible(false);
  }, [forced]);

  return {
    visible,
    forced,
    latestVersion,
    openStore,
    dismiss,
  };
}
