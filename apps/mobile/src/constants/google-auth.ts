import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = Constants.expoConfig?.extra as
  | {
      googleWebClientId?: string;
      googleIosClientId?: string;
      googleAndroidClientId?: string;
      googleRedirectUri?: string;
    }
  | undefined;

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  extra?.googleWebClientId ??
  "";

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  extra?.googleIosClientId ??
  "";

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
  extra?.googleAndroidClientId ??
  "";

/** Expo Go dev: https://auth.expo.io/@YOUR_EXPO_USERNAME/vaara-parents */
export const GOOGLE_REDIRECT_URI =
  process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ??
  extra?.googleRedirectUri ??
  "";

function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/** True only when this build can safely initialize Google auth on the current platform. */
export function isGoogleSignInConfigured(): boolean {
  if (!GOOGLE_WEB_CLIENT_ID) return false;

  if (Platform.OS === "android") {
    // Standalone Android APK requires a native Android OAuth client id.
    if (!isExpoGo()) {
      return Boolean(GOOGLE_ANDROID_CLIENT_ID);
    }
    return Boolean(GOOGLE_REDIRECT_URI);
  }

  if (Platform.OS === "ios") {
    if (!isExpoGo()) {
      return Boolean(GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
    }
    return Boolean(GOOGLE_REDIRECT_URI);
  }

  return Boolean(GOOGLE_REDIRECT_URI);
}
