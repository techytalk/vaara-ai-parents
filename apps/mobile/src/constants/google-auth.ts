import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | {
      googleWebClientId?: string;
    }
  | undefined;

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

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}
