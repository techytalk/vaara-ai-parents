import assert from "node:assert/strict";
import test from "node:test";
import {
  areaNamesConflict,
  areaNamesSupportMatch,
  normalizePlace,
  sameMetroCity,
  stripSafeAreaSuffix,
} from "../src/lib/areas/normalize.js";
import { parseGoogleAddress } from "../src/lib/areas/parse-address.js";
import { areaCityForStoredLocation } from "../src/lib/areas/parent-city.js";
import {
  issuePlaceSelection,
  readPlaceSelection,
} from "../src/lib/areas/selection.js";

test("normalizes area names and safe village suffixes", () => {
  assert.equal(normalizePlace("GACHIBOWLI"), "gachibowli");
  assert.equal(stripSafeAreaSuffix("gachibowli village"), "gachibowli");
  assert.equal(areaNamesSupportMatch("Gachibowli Village", "Gachibowli"), true);
  assert.equal(areaNamesSupportMatch("Kondapur Phase 2", "Kondapur"), false);
  assert.equal(areaNamesConflict("Kondapur Phase 2", "Kondapur"), true);
  assert.equal(areaNamesSupportMatch("Financial District", "Gachibowli"), false);
});

test("treats Hyderabad and Secunderabad as the same metro", () => {
  assert.equal(sameMetroCity("Hyderabad", "Secunderabad"), true);
  assert.equal(sameMetroCity("Hyderabad", "Warangal"), false);
});

test("parses an apartment into community plus area, not district", () => {
  const parsed = parseGoogleAddress({
    displayName: "My Home Bhooja",
    types: ["premise"],
    addressComponents: [
      { longText: "My Home Bhooja", types: ["premise"] },
      { longText: "Gachibowli", types: ["sublocality_level_1"] },
      { longText: "Hyderabad", types: ["locality"] },
      { longText: "Rangareddy", types: ["administrative_area_level_2"] },
      { longText: "Telangana", types: ["administrative_area_level_1"] },
      { longText: "India", shortText: "IN", types: ["country"] },
      { longText: "500032", types: ["postal_code"] },
    ],
  });
  assert.equal(parsed.communityName, "My Home Bhooja");
  assert.equal(parsed.areaName, "Gachibowli");
  assert.equal(parsed.city, "Hyderabad");
  assert.equal(parsed.district, "Rangareddy");
  assert.equal(parsed.postalCode, "500032");
});

test("asks for an area when Google returns only a building", () => {
  const parsed = parseGoogleAddress({
    displayName: "My Home Bhooja",
    types: ["premise"],
    addressComponents: [
      { longText: "Hyderabad", types: ["locality"] },
      { longText: "Telangana", types: ["administrative_area_level_1"] },
    ],
  });
  assert.equal(parsed.areaName, null);
  assert.equal(parsed.communityName, "My Home Bhooja");
});

test("place selection tokens expire and reject tampering", () => {
  process.env.JWT_SECRET = "test-secret";
  const token = issuePlaceSelection({
    source: "places",
    countryCode: "IN",
    areaName: "Gachibowli",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500032",
    communityName: null,
    providerPlaceId: null,
    needsArea: false,
    exp: Date.now() + 1000,
  });
  assert.equal(readPlaceSelection(token)?.areaName, "Gachibowli");
  assert.equal(readPlaceSelection(`${token}x`), null);
  const expired = issuePlaceSelection({
    source: "postal",
    countryCode: "IN",
    areaName: "Kondapur",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: null,
    communityName: null,
    providerPlaceId: null,
    needsArea: false,
    exp: Date.now() - 1000,
  });
  assert.equal(readPlaceSelection(expired), null);
});

test("maps seeded west-Hyderabad localities off a stored district", () => {
  assert.equal(
    areaCityForStoredLocation("Gachibowli Village", "K.v.rangareddy").city,
    "Hyderabad"
  );
  assert.equal(
    areaCityForStoredLocation("Nanakramguda", "Medak").hyderabadOverride,
    true
  );
  assert.equal(
    areaCityForStoredLocation("Kondapur Phase 2", "K.v.rangareddy").city,
    "K.v.rangareddy"
  );
  assert.equal(
    areaCityForStoredLocation("HSR Layout", "Bengaluru").city,
    "Bengaluru"
  );
});
