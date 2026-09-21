import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeVercelGeoValue,
  isLaunchMetro,
  readVercelIpGeo,
} from "../src/lib/onboarding-geo.js";

test("decodes Vercel URI-encoded city names", () => {
  assert.equal(decodeVercelGeoValue("Hyderabad"), "Hyderabad");
  assert.equal(decodeVercelGeoValue("San%20Francisco"), "San Francisco");
  assert.equal(decodeVercelGeoValue("New+Delhi"), "New Delhi");
  assert.equal(decodeVercelGeoValue(""), null);
  assert.equal(decodeVercelGeoValue(undefined), null);
});

test("reads Vercel geo headers without storing an IP", () => {
  const geo = readVercelIpGeo({
    header: (name) => {
      if (name === "x-vercel-ip-city") return "Warangal";
      if (name === "x-vercel-ip-country-region") return "TG";
      if (name === "x-vercel-ip-country") return "in";
      return undefined;
    },
  });
  assert.deepEqual(geo, {
    city: "Warangal",
    region: "TG",
    country: "IN",
  });
});

test("launch metro is Hyderabad, Secunderabad, or IN 500xxx PIN", () => {
  assert.equal(isLaunchMetro({ city: "Hyderabad" }), true);
  assert.equal(isLaunchMetro({ city: "Secunderabad" }), true);
  assert.equal(isLaunchMetro({ pin: "500032", countryCode: "IN" }), true);
  assert.equal(isLaunchMetro({ city: "Warangal", pin: "506001" }), false);
  assert.equal(isLaunchMetro({ city: "Jaipur", pin: "302001" }), false);
});
