import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDistrictAsCity,
  formatStateName,
  getPostalCountry,
  isValidIndianPinCode,
  listPostalCountries,
} from "../src/lib/postal-code/index.js";

test("validates Indian pin codes", () => {
  assert.equal(isValidIndianPinCode("560102"), true);
  assert.equal(isValidIndianPinCode("110001"), true);
  assert.equal(isValidIndianPinCode("012345"), false);
  assert.equal(isValidIndianPinCode("56010"), false);
  assert.equal(isValidIndianPinCode("abc123"), false);
});

test("formats district names into city labels", () => {
  assert.equal(formatDistrictAsCity("BENGALURU URBAN"), "Bengaluru");
  assert.equal(formatDistrictAsCity("Bangalore"), "Bengaluru");
  assert.equal(formatDistrictAsCity("NEW DELHI"), "New Delhi");
});

test("formats state names", () => {
  assert.equal(formatStateName("KARNATAKA"), "Karnataka");
  assert.equal(formatStateName("NCT OF DELHI"), "Delhi");
});

test("exposes country registry with India first", () => {
  const countries = listPostalCountries();
  assert.equal(countries[0]?.code, "IN");
  assert.ok(countries.some((country) => country.code === "US"));
});

test("validates country-specific postal formats", () => {
  const us = getPostalCountry("US");
  const gb = getPostalCountry("GB");
  assert.equal(us?.validate("90210"), true);
  assert.equal(us?.validate("90210-1234"), true);
  assert.equal(gb?.validate("SW1A1AA"), true);
  assert.equal(gb?.validate("INVALID"), false);
  assert.equal(gb?.provider, "uk");
});

test("builds UK localities from postcodes.io fields", async () => {
  const { buildLocalitiesFromPostcodesIo, buildLookupFromPostcodesIo } =
    await import("../src/lib/postal-code/providers/uk.js");

  const lookup = buildLookupFromPostcodesIo("SW1A 1AA", {
    postcode: "SW1A 1AA",
    country: "England",
    region: "London",
    admin_district: "Westminster",
    admin_ward: "St James's",
    parish: "Westminster, unparished area",
    nuts: "Westminster",
  });

  assert.equal(lookup.city, "Westminster");
  assert.equal(lookup.state, "England");
  assert.ok(lookup.localities.some((locality) => locality.name === "St James's"));
  assert.ok(lookup.localities.some((locality) => locality.name === "Westminster"));
  assert.equal(
    buildLocalitiesFromPostcodesIo({
      admin_district: "Westminster",
      admin_ward: "St James's",
    }).length,
    2
  );
});

test("unions UK postcodes.io and zippopotam localities", async () => {
  const { mergePostalCodeLookups } = await import(
    "../src/lib/postal-code/providers/storage.js"
  );

  const postcodesIo = {
    countryCode: "GB",
    countryName: "United Kingdom",
    postalCode: "SW1A 1AA",
    state: "England",
    city: "Westminster",
    district: "Westminster",
    localities: [
      { name: "St James's", officeType: null, deliveryStatus: null },
      { name: "Westminster", officeType: null, deliveryStatus: null },
    ],
  };
  const zippopotam = {
    countryCode: "GB",
    countryName: "United Kingdom",
    postalCode: "SW1A 1AA",
    state: "England",
    city: "London",
    district: "London",
    localities: [{ name: "London", officeType: null, deliveryStatus: null }],
  };

  const merged = mergePostalCodeLookups(postcodesIo, zippopotam);
  assert.equal(merged?.localities.length, 3);
});

test("unions cached and remote localities instead of replacing them", async () => {
  const { isIndiaCacheStale, mergePostalCodeLookups } = await import(
    "../src/lib/postal-code/providers/storage.js"
  );

  const cached = {
    countryCode: "IN",
    countryName: "India",
    postalCode: "500055",
    state: "Telangana",
    city: "Hyderabad",
    district: "Hyderabad",
    localities: [
      { name: "Only In Cache", officeType: null, deliveryStatus: null },
      { name: "Gajularamaram", officeType: null, deliveryStatus: null },
    ],
  };
  const remote = {
    ...cached,
    localities: [
      {
        name: "Gajularamaram",
        officeType: "Branch Post Office",
        deliveryStatus: "Delivery",
      },
      { name: "IDA Jeedimetla", officeType: "Sub Post Office", deliveryStatus: "Delivery" },
    ],
  };

  const merged = mergePostalCodeLookups(cached, remote);
  assert.equal(isIndiaCacheStale(cached), true);
  assert.equal(merged?.localities.length, 3);
  assert.deepEqual(
    merged?.localities.map((locality) => locality.name).sort(),
    ["Gajularamaram", "IDA Jeedimetla", "Only In Cache"]
  );
  assert.equal(
    merged?.localities.find((locality) => locality.name === "Gajularamaram")
      ?.officeType,
    "Branch Post Office"
  );
});
