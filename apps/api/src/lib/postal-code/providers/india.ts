import type { PoolClient } from "pg";
import {
  cleanOfficeName,
  formatDistrictAsCity,
  formatStateName,
  titleCaseWords,
} from "../format.js";
import type { PostalCodeLocality, PostalCodeLookup } from "../types.js";
import {
  isIndiaCacheStale,
  loadPostalCodeFromDb,
  mergePostalCodeLookups,
  savePostalCodeOffices,
} from "./storage.js";

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

function finalizeIndiaLookup(lookup: PostalCodeLookup): PostalCodeLookup {
  const localities = [...lookup.localities].sort((a, b) => {
    const rankDiff =
      officeTypeRank(a.officeType) - officeTypeRank(b.officeType);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });

  return {
    ...lookup,
    countryCode: "IN",
    countryName: "India",
    city: formatDistrictAsCity(lookup.district),
    state: formatStateName(lookup.state),
    district: titleCaseWords(lookup.district),
    localities,
  };
}

function buildIndiaLookup(
  postalCode: string,
  stateName: string,
  district: string,
  offices: PostalCodeLocality[]
): PostalCodeLookup {
  return finalizeIndiaLookup({
    countryCode: "IN",
    countryName: "India",
    postalCode,
    state: stateName,
    city: district,
    district,
    localities: offices,
  });
}

export async function loadIndiaPostalCodeFromDb(
  client: PoolClient,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const cached = await loadPostalCodeFromDb(client, "IN", postalCode);
  if (!cached) return null;
  return finalizeIndiaLookup({
    ...cached,
    countryName: "India",
  });
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

  if (cached && !isIndiaCacheStale(cached)) {
    return cached;
  }

  const remote = await loadIndiaPostalCodeFromPostalApi(postalCode);
  const bundled = remote
    ? null
    : await loadIndiaPostalCodeFromBundledDataset(postalCode);

  const merged = mergePostalCodeLookups(cached, remote, bundled);
  if (!merged) return null;

  const result = finalizeIndiaLookup(merged);
  await savePostalCodeOffices(
    client,
    "IN",
    postalCode,
    result.state,
    result.district,
    result.localities
  );
  return result;
}
