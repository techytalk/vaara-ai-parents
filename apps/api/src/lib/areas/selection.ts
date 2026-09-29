import { createHmac, timingSafeEqual } from "node:crypto";

export type PlaceSelection = {
  source: "places" | "postal" | "pin";
  countryCode: string;
  areaName: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  communityName: string | null;
  providerPlaceId: string | null;
  needsArea: boolean;
  exp: number;
};

const TTL_MS = 15 * 60 * 1000;

function secret(): string {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) throw new Error("JWT_SECRET is required to sign place selections");
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issuePlaceSelection(
  input: Omit<PlaceSelection, "exp"> & { exp?: number }
): string {
  const payload: PlaceSelection = {
    ...input,
    countryCode: input.countryCode.toUpperCase(),
    exp: input.exp ?? Date.now() + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readPlaceSelection(token: string): PlaceSelection | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PlaceSelection;
    if (!parsed?.exp || parsed.exp < Date.now()) return null;
    if (!parsed.city || !parsed.countryCode) return null;
    return parsed;
  } catch {
    return null;
  }
}
