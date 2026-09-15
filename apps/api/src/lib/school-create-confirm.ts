import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 15 * 60 * 1000;

type ConfirmPayload = {
  v: 1;
  userId: string;
  name: string;
  branch: string | null;
  city: string;
  locality: string | null;
  candidateIds: string[];
  exp: number;
};

function secret(): string {
  return (
    process.env.SCHOOL_CREATE_CONFIRM_SECRET ||
    process.env.JWT_SECRET ||
    "dev-secret-change-in-production"
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signBody(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function schoolCreateFingerprint(input: {
  name: string;
  branch: string | null;
  city: string;
  locality: string | null;
}): string {
  return [
    input.name.trim().toLowerCase(),
    (input.branch ?? "").trim().toLowerCase(),
    input.city.trim().toLowerCase(),
    (input.locality ?? "").trim().toLowerCase(),
  ].join("|");
}

export function issueSchoolCreateConfirmToken(input: {
  userId: string;
  name: string;
  branch: string | null;
  city: string;
  locality: string | null;
  candidateIds: string[];
}): string {
  const payload: ConfirmPayload = {
    v: 1,
    userId: input.userId,
    name: input.name.trim(),
    branch: input.branch?.trim() || null,
    city: input.city.trim(),
    locality: input.locality?.trim() || null,
    candidateIds: [...input.candidateIds].sort(),
    exp: Date.now() + TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${signBody(body)}`;
}

export function verifySchoolCreateConfirmToken(
  token: string,
  expected: {
    userId: string;
    name: string;
    branch: string | null;
    city: string;
    locality: string | null;
  }
): { ok: true; candidateIds: string[] } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Invalid confirmation token" };
  const [body, sig] = parts;
  const expectedSig = signBody(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid confirmation token" };
    }
  } catch {
    return { ok: false, error: "Invalid confirmation token" };
  }

  let payload: ConfirmPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as ConfirmPayload;
  } catch {
    return { ok: false, error: "Invalid confirmation token" };
  }

  if (payload.v !== 1) return { ok: false, error: "Invalid confirmation token" };
  if (payload.exp < Date.now()) {
    return { ok: false, error: "Confirmation expired — search again" };
  }
  if (payload.userId !== expected.userId) {
    return { ok: false, error: "Confirmation token mismatch" };
  }

  const left = schoolCreateFingerprint({
    name: payload.name,
    branch: payload.branch,
    city: payload.city,
    locality: payload.locality,
  });
  const right = schoolCreateFingerprint(expected);
  if (left !== right) {
    return { ok: false, error: "School details changed — confirm again" };
  }

  return { ok: true, candidateIds: payload.candidateIds ?? [] };
}
