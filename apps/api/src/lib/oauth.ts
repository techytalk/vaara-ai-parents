import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export const OAUTH_ISSUER = "https://auth.vaara.ai";
const COOKIE = "vaara_oauth";

export function oauthCookieName(): string {
  return COOKIE;
}

export function signingKey(): Uint8Array | null {
  const raw = process.env.OAUTH_SIGNING_SECRET?.trim();
  if (raw) return new TextEncoder().encode(raw);
  if (process.env.VERCEL) return null;
  return new TextEncoder().encode("dev-oauth-signing-secret");
}

export function randomToken(): string {
  return base64url(randomBytes(32));
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  const digest = createHash("sha256").update(verifier).digest();
  const expected = base64url(digest);
  const a = Buffer.from(expected);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function pairwiseSubject(salt: string, kind: "parent" | "child", internalId: string): string {
  const digest = createHmac("sha256", salt).update(`${kind}:${internalId}`).digest();
  const prefix = kind === "parent" ? "p_" : "c_";
  return prefix + base64url(digest).slice(0, 22);
}

export type OauthLoginClaims = {
  purpose: "oauth_login";
  sub?: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
};

export async function signLoginCookie(claims: OauthLoginClaims): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error("OAUTH_SIGNING_SECRET is not set");
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(key);
}

export async function readLoginCookie(token: string): Promise<OauthLoginClaims | null> {
  const key = signingKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.purpose !== "oauth_login") return null;
    if (typeof payload.clientId !== "string" || typeof payload.redirectUri !== "string") return null;
    if (typeof payload.state !== "string" || typeof payload.codeChallenge !== "string") return null;
    return {
      purpose: "oauth_login",
      sub: typeof payload.sub === "string" ? payload.sub : undefined,
      clientId: payload.clientId,
      redirectUri: payload.redirectUri,
      state: payload.state,
      codeChallenge: payload.codeChallenge,
    };
  } catch {
    return null;
  }
}

export async function signIdToken(input: {
  clientId: string;
  parentSub: string;
  childRef: string;
  childNickname: string;
  classLabel: string | null;
}): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error("OAUTH_SIGNING_SECRET is not set");
  return new SignJWT({
    child_ref: input.childRef,
    child_nickname: input.childNickname,
    class_label: input.classLabel,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(OAUTH_ISSUER)
    .setAudience(input.clientId)
    .setSubject(input.parentSub)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}
