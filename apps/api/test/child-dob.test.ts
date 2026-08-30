import assert from "node:assert/strict";
import test from "node:test";
import {
  formatChildDateOfBirth,
  parseChildDateOfBirth,
} from "../src/lib/child-dob.js";

test("accepts a valid past date", () => {
  assert.equal(parseChildDateOfBirth("2018-06-15"), "2018-06-15");
});

test("rejects future dates", () => {
  assert.equal(parseChildDateOfBirth("2099-01-01"), null);
});

test("rejects invalid strings", () => {
  assert.equal(parseChildDateOfBirth("15-06-2018"), null);
  assert.equal(parseChildDateOfBirth(""), null);
});

test("formats database values", () => {
  assert.equal(formatChildDateOfBirth("2018-06-15"), "2018-06-15");
  assert.equal(formatChildDateOfBirth(new Date(2018, 5, 15)), "2018-06-15");
});
