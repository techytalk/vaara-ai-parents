import Constants from "expo-constants";

type GoogleExtra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

const extra = Constants.expoConfig?.extra as GoogleExtra | undefined;

function readConfigValue(
  envValue: string | undefined,
  extraValue: string | undefined
): string {
  const fromEnv = envValue?.trim();
  if (fromEnv) return fromEnv;

  const fromExtra = extraValue?.trim();
  if (fromExtra) return fromExtra;

  return "";
}

/** Web client ID — required for native Google Sign-In id tokens. */
export const GOOGLE_WEB_CLIENT_ID = readConfigValue(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  extra?.googleWebClientId
);

/** iOS OAuth client ID — required for native Google Sign-In on iOS. */
export const GOOGLE_IOS_CLIENT_ID = readConfigValue(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  extra?.googleIosClientId
);

/** Android OAuth client ID — used on standalone Android builds. */
export const GOOGLE_ANDROID_CLIENT_ID = readConfigValue(
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  extra?.googleAndroidClientId
);

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}
