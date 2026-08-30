export type PostalCodeLocality = {
  name: string;
  officeType: string | null;
  deliveryStatus: string | null;
};

export type PostalCodeLookup = {
  countryCode: string;
  countryName: string;
  postalCode: string;
  state: string;
  city: string;
  district: string;
  localities: PostalCodeLocality[];
};

export type PostalCountryProvider = "india" | "uk" | "zippopotam" | "manual";

export type PostalCountryConfig = {
  code: string;
  name: string;
  postalLabel: string;
  placeholder: string;
  provider: PostalCountryProvider;
  normalize: (input: string) => string;
  validate: (input: string) => boolean;
};
