import type { PostalCountryConfig } from "./types.js";

const ZIPPOTAM_COUNTRIES = new Set([
  "AD", "AR", "AS", "AT", "AU", "BD", "BE", "BG", "BM", "BR", "BY", "CA", "CH",
  "CL", "CN", "CO", "CR", "CY", "CZ", "DE", "DK", "DO", "DZ", "EC", "EE", "ES",
  "FI", "FM", "FO", "FR", "GB", "GF", "GG", "GL", "GP", "GT", "GU", "GY", "HK",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IS", "IT", "JE", "JP", "KE",
  "KH", "KR", "LI", "LK", "LT", "LU", "LV", "MA", "MC", "MD", "MH", "MK", "MP",
  "MQ", "MT", "MW", "MX", "MY", "NC", "NL", "NO", "NZ", "PE", "PH", "PK", "PL",
  "PM", "PN", "PR", "PT", "PW", "RE", "RO", "RS", "RU", "SE", "SG", "SH", "SI",
  "SJ", "SK", "SM", "SZ", "TC", "TH", "TR", "TV", "TW", "UA", "US", "UY", "UZ",
  "VA", "VI", "WF", "WS", "YT", "ZA",
]);

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function compactUpper(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function loosePostal(value: string): string {
  return value.trim().toUpperCase();
}

const COUNTRY_DEFINITIONS: Array<
  Omit<PostalCountryConfig, "provider"> & { provider?: PostalCountryConfig["provider"] }
> = [
  {
    code: "IN",
    name: "India",
    postalLabel: "PIN code",
    placeholder: "e.g. 560102",
    normalize: digitsOnly,
    validate: (value) => /^[1-9][0-9]{5}$/.test(value),
    provider: "india",
  },
  {
    code: "US",
    name: "United States",
    postalLabel: "ZIP code",
    placeholder: "e.g. 90210",
    normalize: (value) => {
      const digits = digitsOnly(value);
      return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5, 9)}` : digits;
    },
    validate: (value) => /^\d{5}(-\d{4})?$/.test(value),
  },
  {
    code: "GB",
    name: "United Kingdom",
    postalLabel: "Postcode",
    placeholder: "e.g. SW1A 1AA",
    normalize: compactUpper,
    validate: (value) => /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compactUpper(value)),
  },
  {
    code: "CA",
    name: "Canada",
    postalLabel: "Postal code",
    placeholder: "e.g. K1A 0B1",
    normalize: (value) => {
      const compact = compactUpper(value).replace(/[^A-Z0-9]/g, "");
      return compact.length === 6
        ? `${compact.slice(0, 3)} ${compact.slice(3)}`
        : compact;
    },
    validate: (value) => {
      const compact = compactUpper(value).replace(/[^A-Z0-9]/g, "");
      const normalized =
        compact.length === 6
          ? `${compact.slice(0, 3)} ${compact.slice(3)}`
          : compact;
      return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(normalized);
    },
  },
  {
    code: "AU",
    name: "Australia",
    postalLabel: "Postcode",
    placeholder: "e.g. 2000",
    normalize: digitsOnly,
    validate: (value) => /^\d{4}$/.test(value),
  },
  {
    code: "SG",
    name: "Singapore",
    postalLabel: "Postal code",
    placeholder: "e.g. 238858",
    normalize: digitsOnly,
    validate: (value) => /^\d{6}$/.test(value),
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    postalLabel: "Postal code",
    placeholder: "Optional in UAE",
    normalize: digitsOnly,
    validate: (value) => value.length === 0 || /^\d{1,5}$/.test(value),
  },
  {
    code: "DE",
    name: "Germany",
    postalLabel: "Postleitzahl",
    placeholder: "e.g. 10115",
    normalize: digitsOnly,
    validate: (value) => /^\d{5}$/.test(value),
  },
  {
    code: "FR",
    name: "France",
    postalLabel: "Code postal",
    placeholder: "e.g. 75001",
    normalize: digitsOnly,
    validate: (value) => /^\d{5}$/.test(value),
  },
  {
    code: "NL",
    name: "Netherlands",
    postalLabel: "Postcode",
    placeholder: "e.g. 1012 AB",
    normalize: (value) => {
      const compact = compactUpper(value).replace(/[^A-Z0-9]/g, "");
      return compact.length > 4
        ? `${compact.slice(0, 4)} ${compact.slice(4)}`
        : compact;
    },
    validate: (value) => {
      const compact = compactUpper(value).replace(/[^A-Z0-9]/g, "");
      const normalized =
        compact.length > 4
          ? `${compact.slice(0, 4)} ${compact.slice(4)}`
          : compact;
      return /^\d{4}\s?[A-Z]{2}$/.test(normalized);
    },
  },
  {
    code: "JP",
    name: "Japan",
    postalLabel: "Postal code",
    placeholder: "e.g. 100-0001",
    normalize: (value) => {
      const digits = digitsOnly(value);
      return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}` : digits;
    },
    validate: (value) => {
      const digits = digitsOnly(value);
      const normalized =
        digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}` : digits;
      return /^\d{3}-?\d{4}$/.test(normalized);
    },
  },
];

function resolveProvider(code: string): PostalCountryConfig["provider"] {
  if (code === "IN") return "india";
  if (ZIPPOTAM_COUNTRIES.has(code)) return "zippopotam";
  return "manual";
}

const registry = new Map<string, PostalCountryConfig>();

for (const definition of COUNTRY_DEFINITIONS) {
  registry.set(definition.code, {
    ...definition,
    provider: definition.provider ?? resolveProvider(definition.code),
  });
}

for (const code of ZIPPOTAM_COUNTRIES) {
  if (registry.has(code)) continue;
  registry.set(code, {
    code,
    name: code,
    postalLabel: "Postal code",
    placeholder: "Enter postal code",
    provider: "zippopotam",
    normalize: loosePostal,
    validate: (value) => value.trim().length >= 2,
  });
}

export function normalizeCountryCode(input: string): string {
  return input.trim().toUpperCase();
}

export function getPostalCountry(codeInput: string): PostalCountryConfig | null {
  const code = normalizeCountryCode(codeInput);
  return registry.get(code) ?? null;
}

export function listPostalCountries(): PostalCountryConfig[] {
  const featured = ["IN", "US", "GB", "CA", "AU", "SG", "AE", "DE", "FR", "NL", "JP"];
  const featuredSet = new Set(featured);
  const featuredCountries = featured
    .map((code) => registry.get(code))
    .filter((country): country is PostalCountryConfig => Boolean(country));
  const remaining = [...registry.values()]
    .filter((country) => !featuredSet.has(country.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...featuredCountries, ...remaining];
}

export function isZippopotamCountry(code: string): boolean {
  return ZIPPOTAM_COUNTRIES.has(normalizeCountryCode(code));
}
