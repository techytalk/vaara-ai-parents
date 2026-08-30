import type { PoolClient } from "pg";
import {
  cleanOfficeName,
  formatDistrictAsCity,
  formatStateName,
  titleCaseWords,
} from "../format.js";
import type { PostalCodeLocality, PostalCodeLookup } from "../types.js";
import { loadPostalCodeFromDb, savePostalCodeOffices } from "./storage.js";

function officeTypeRank(officeType: string | null): number {
  switch ((officeType ?? "").toUpperCase()) {
    case "HO":
    case "H.O":
    case "HEAD OFFICE":
      return 0;
    case "SO":
    case "S.O":
    case "SUB POST OFFICE":
    case "PO":
      return 1;
  }
  return 2;
}

function buildIndiaLookup(
  postalCode: string,
  stateName: string,
  district: string,
  offices: PostalCodeLocality[]
): PostalCodeLookup {
  const localities = [...offices].sort((a, b) => {
    const rankDiff =
      officeTypeRank(a.officeType) - officeTypeRank(b.officeType);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });

  const city = formatDistrictAsCity(district);
  return {
    countryCode: "IN",
    countryName: "India",
    postalCode,
    state: formatStateName(stateName),
    city,
    district: titleCaseWords(district),
    localities,
  };
}

export async function loadIndiaPostalCodeFromDb(
  client: PoolClient,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const cached = await loadPostalCodeFromDb(client, "IN", postalCode);
  if (!cached) return null;
  return {
    ...cached,
    countryName: "India",
    city: formatDistrictAsCity(cached.district),
    state: formatStateName(cached.state),
    district: titleCaseWords(cached.district),
  };
}

async function loadIndiaPostalCodeFromBundledDataset(
  postalCode: string
): Promise<PostalCodeLookup | null> {
  try {
    const mod = await import("@twin.techies/india-pincode");
    const result = mod.getByPincode(postalCode);
    const localities = result.offices.map((office) => ({
      name: cleanOfficeName(office.name),
      officeType: null,
      deliveryStatus: null,
    }));
    return buildIndiaLookup(postalCode, result.state, result.district, localities);
  } catch {
    return null;
  }
}

type PostalApiOffice = {
  Name?: string;
  BranchType?: string;
  DeliveryStatus?: string;
  District?: string;
  State?: string;
};

async function loadIndiaPostalCodeFromPostalApi(
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const response = await fetch(
    `https://api.postalpincode.in/pincode/${postalCode}`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as Array<{
    Status?: string;
    PostOffice?: PostalApiOffice[] | null;
  }>;
  const entry = payload[0];
  if (entry?.Status !== "Success" || !entry.PostOffice?.length) {
    return null;
  }

  const district = entry.PostOffice[0].District?.trim();
  const stateName = entry.PostOffice[0].State?.trim();
  if (!district || !stateName) return null;

  const localities = entry.PostOffice.map((office) => ({
    name: cleanOfficeName(office.Name?.trim() ?? ""),
    officeType: office.BranchType?.trim() ?? null,
    deliveryStatus: office.DeliveryStatus?.trim() ?? null,
  })).filter((office) => office.name.length > 0);

  if (localities.length === 0) return null;
  return buildIndiaLookup(postalCode, stateName, district, localities);
}

export async function lookupIndiaPostalCode(
  client: PoolClient,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const cached = await loadIndiaPostalCodeFromDb(client, postalCode);
  if (cached) return cached;

  const bundled = await loadIndiaPostalCodeFromBundledDataset(postalCode);
  if (bundled) {
    await savePostalCodeOffices(
      client,
      "IN",
      postalCode,
      bundled.state,
      bundled.district,
      bundled.localities
    );
    return bundled;
  }

  const remote = await loadIndiaPostalCodeFromPostalApi(postalCode);
  if (!remote) return null;

  await savePostalCodeOffices(
    client,
    "IN",
    postalCode,
    remote.state,
    remote.district,
    remote.localities
  );
  return remote;
}
