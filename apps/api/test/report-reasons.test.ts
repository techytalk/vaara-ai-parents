import assert from "node:assert/strict";
import test from "node:test";
import { parseReportReason } from "../src/lib/report-reasons.js";

test("accepts a predefined reason id", () => {
  const result = parseReportReason({ reasonId: "spam" });
  assert.deepEqual(result, { ok: true, reason: "Spam or misleading" });
});

test("requires detail for other", () => {
  const result = parseReportReason({ reasonId: "other", otherDetail: "short" });
  assert.deepEqual(result, {
    ok: false,
    error: "Please describe the issue (at least 10 characters)",
  });
});

test("formats other with detail", () => {
  const result = parseReportReason({
    reasonId: "other",
    otherDetail: "This parent keeps messaging me after I declined.",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.reason, /^Something else:/);
  }
});

test("requires a free-text reason when no reason id is sent", () => {
  assert.deepEqual(parseReportReason({}), {
    ok: false,
    error: "reason is required",
  });
});
