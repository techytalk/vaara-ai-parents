import Constants from "expo-constants";

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

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_REDIRECT_URI);
}
