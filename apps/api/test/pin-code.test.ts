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
});
