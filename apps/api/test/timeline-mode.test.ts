import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveFreshnessFlag,
  resolveTimelineMode,
} from "../src/lib/timeline-mode.js";

test("timeline flags default to off unless explicitly enabled", () => {
  assert.equal(resolveTimelineMode(undefined), "off");
  assert.equal(resolveTimelineMode("0"), "off");
  assert.equal(resolveTimelineMode("shadow"), "shadow");
  assert.equal(resolveTimelineMode("1"), "on");
});

test("freshness ranking defaults to off", () => {
  assert.equal(resolveFreshnessFlag(undefined), false);
  assert.equal(resolveFreshnessFlag("0"), false);
  assert.equal(resolveFreshnessFlag("1"), true);
});
