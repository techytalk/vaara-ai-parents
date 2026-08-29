import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { api } from "./api";
import { getToken } from "./session";

const ANDROID_DEFAULT_CHANNEL = "default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

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

  try {
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
  const register = () => {
    registerForPushNotifications().catch(() => {});
  };

  register();

  const tokenSubscription = Notifications.addPushTokenListener(() => {
    register();
  });

  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      register();
    }
  });

  return () => {
    tokenSubscription.remove();
    appStateSubscription.remove();
  };
}
