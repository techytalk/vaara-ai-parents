import { OAuth2Client } from "google-auth-library";

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

function getGoogleClientIds(): string[] {
  const ids = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ].filter((value): value is string => Boolean(value));

  if (ids.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  return [...new Set(ids)];
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdentity> {
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: getGoogleClientIds(),
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name ?? null,
  };
}
