import type { PoolClient } from "pg";

export type VercelIpGeo = {
  city: string | null;
  region: string | null;
  country: string | null;
};

const LAUNCH_CITIES = new Set(["hyderabad", "secunderabad"]);

export function decodeVercelGeoValue(
  raw: string | undefined | null
): string | null {
  if (!raw?.trim()) return null;
  try {
    const decoded = decodeURIComponent(raw.trim().replace(/\+/g, " "));
    const cleaned = decoded.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return cleaned || null;
  } catch {
    return raw.trim() || null;
  }
}

export function readVercelIpGeo(headers: {
  header: (name: string) => string | undefined;
}): VercelIpGeo {
  const country = decodeVercelGeoValue(headers.header("x-vercel-ip-country"));
  return {
    city: decodeVercelGeoValue(headers.header("x-vercel-ip-city")),
    region: decodeVercelGeoValue(headers.header("x-vercel-ip-country-region")),
    country: country ? country.toUpperCase() : null,
  };
}

export function isLaunchMetro(opts: {
  city?: string | null;
  pin?: string | null;
  countryCode?: string | null;
}): boolean {
  const city = opts.city?.trim().toLowerCase() ?? "";
  if (LAUNCH_CITIES.has(city)) return true;
  const country = (opts.countryCode ?? "IN").trim().toUpperCase();
  const pin = opts.pin?.trim() ?? "";
  return country === "IN" && pin.startsWith("500");
}

type HeaderSource = {
  header: (name: string) => string | undefined;
};

export async function recordOnboardingGeoLocation(
  client: PoolClient,
  userId: string,
  entered: {
    countryCode: string;
    pinCode: string;
    locality: string;
    city: string;
    state: string;
  },
  headers: HeaderSource
): Promise<void> {
  const ip = readVercelIpGeo(headers);
  await client.query(
    `INSERT INTO onboarding_geo_signals (
       user_id,
       entered_country_code, entered_pin, entered_locality, entered_city, entered_state, entered_at,
       ip_city, ip_region, ip_country, ip_captured_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, CASE WHEN $7::text IS NULL THEN NULL ELSE now() END, now())
     ON CONFLICT (user_id) DO UPDATE SET
       entered_country_code = EXCLUDED.entered_country_code,
       entered_pin = EXCLUDED.entered_pin,
       entered_locality = EXCLUDED.entered_locality,
       entered_city = EXCLUDED.entered_city,
       entered_state = EXCLUDED.entered_state,
       entered_at = now(),
       ip_city = COALESCE(EXCLUDED.ip_city, onboarding_geo_signals.ip_city),
       ip_region = COALESCE(EXCLUDED.ip_region, onboarding_geo_signals.ip_region),
       ip_country = COALESCE(EXCLUDED.ip_country, onboarding_geo_signals.ip_country),
       ip_captured_at = CASE
         WHEN EXCLUDED.ip_city IS NOT NULL THEN EXCLUDED.ip_captured_at
         ELSE onboarding_geo_signals.ip_captured_at
       END,
       updated_at = now()`,
    [
      userId,
      entered.countryCode,
      entered.pinCode,
      entered.locality,
      entered.city,
      entered.state,
      ip.city,
      ip.region,
      ip.country,
    ]
  );

  console.log(
    JSON.stringify({
      event: "onboarding_geo",
      phase: "location",
      entered_city: entered.city,
      ip_city: ip.city,
      entered_launch: isLaunchMetro({
        city: entered.city,
        pin: entered.pinCode,
        countryCode: entered.countryCode,
      }),
      ip_launch: isLaunchMetro({ city: ip.city }),
    })
  );
}

export async function recordOnboardingGeoSchool(
  client: PoolClient,
  userId: string,
  school: {
    id: string;
    city: string | null;
    state: string | null;
    pinCode: string | null;
  },
  headers: HeaderSource
): Promise<void> {
  const ip = readVercelIpGeo(headers);
  await client.query(
    `INSERT INTO onboarding_geo_signals (
       user_id,
       school_id, school_city, school_state, school_pin, school_at,
       school_ip_city, school_ip_region, school_ip_country, school_ip_captured_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, CASE WHEN $6::text IS NULL THEN NULL ELSE now() END, now())
     ON CONFLICT (user_id) DO UPDATE SET
       school_id = EXCLUDED.school_id,
       school_city = EXCLUDED.school_city,
       school_state = EXCLUDED.school_state,
       school_pin = EXCLUDED.school_pin,
       school_at = now(),
       school_ip_city = COALESCE(EXCLUDED.school_ip_city, onboarding_geo_signals.school_ip_city),
       school_ip_region = COALESCE(EXCLUDED.school_ip_region, onboarding_geo_signals.school_ip_region),
       school_ip_country = COALESCE(EXCLUDED.school_ip_country, onboarding_geo_signals.school_ip_country),
       school_ip_captured_at = CASE
         WHEN EXCLUDED.school_ip_city IS NOT NULL THEN EXCLUDED.school_ip_captured_at
         ELSE onboarding_geo_signals.school_ip_captured_at
       END,
       updated_at = now()`,
    [
      userId,
      school.id,
      school.city,
      school.state,
      school.pinCode,
      ip.city,
      ip.region,
      ip.country,
    ]
  );

  console.log(
    JSON.stringify({
      event: "onboarding_geo",
      phase: "school",
      school_city: school.city,
      ip_city: ip.city,
      school_launch: isLaunchMetro({
        city: school.city,
        pin: school.pinCode,
      }),
      ip_launch: isLaunchMetro({ city: ip.city }),
    })
  );
}
