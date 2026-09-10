import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AppleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  isPrivateEmail: boolean;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

function claimIsTrue(value: unknown): boolean {
  return value === true || value === "true";
}

export function getAppleAudiences(): string[] {
  const ids = [
    process.env.APPLE_BUNDLE_ID,
    process.env.APPLE_CLIENT_ID,
    "com.vaara.parents",
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(ids.map((value) => value.trim()))];
}

export function parseAppleTokenPayload(payload: JWTPayload): AppleIdentity {
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub) {
    throw new Error("Invalid Apple token payload");
  }

  const email =
    typeof payload.email === "string" && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : null;

  return {
    sub,
    email,
    emailVerified: claimIsTrue(payload.email_verified),
    isPrivateEmail: claimIsTrue(payload.is_private_email),
  };
}

export async function verifyAppleIdentityToken(
  identityToken: string
): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: getAppleAudiences(),
  });

  return parseAppleTokenPayload(payload);
}
