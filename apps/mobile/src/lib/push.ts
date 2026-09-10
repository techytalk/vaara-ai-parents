import * as Device from "expo-device";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { api } from "./api";
import { getToken } from "./session";

const ANDROID_DEFAULT_CHANNEL = "default";

async function notifications() {
  return import("expo-notifications");
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const Notifications = await notifications();
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL, {
    name: "Notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0E9A8A",
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  try {
    const Notifications = await notifications();
    await ensureAndroidNotificationChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenData.data;

    const authToken = await getToken();
    if (authToken && pushToken) {
      await api.registerPushToken(authToken, pushToken);
    }

    return pushToken;
  } catch {
    return null;
  }
}

export function setupPushNotifications(): () => void {
  // Simulator / Expo Go-style binaries lack PushNotificationIOS. Skip entirely
  // so we never construct a NativeEventEmitter against a null native module.
  if (!Device.isDevice) {
    return () => {};
  }

  let cancelled = false;
  let tokenSubscription: { remove?: () => void } | undefined;
  let appStateSubscription: { remove?: () => void } | undefined;

  const register = () => {
    registerForPushNotifications().catch(() => {});
  };

  register();

  void notifications()
    .then((Notifications) => {
      if (cancelled) return;
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        tokenSubscription = Notifications.addPushTokenListener(() => {
          register();
        });
      } catch {
        // Incomplete native binaries can throw NativeEventEmitter errors.
      }
    })
    .catch(() => {});

  appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      register();
    }
  });

  return () => {
    cancelled = true;
    tokenSubscription?.remove?.();
    appStateSubscription?.remove?.();
  };
}
