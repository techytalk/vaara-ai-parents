import assert from "node:assert/strict";
import test from "node:test";
import { parseImpressionPostIds } from "../src/services/feed-impressions.js";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";

test("accepts unique valid post ids", () => {
  const parsed = parseImpressionPostIds({ postIds: [idA, idB, idA] });
  assert.deepEqual(parsed, { postIds: [idA, idB] });
});

test("rejects missing arrays and invalid ids", () => {
  assert.deepEqual(parseImpressionPostIds({}), {
    error: "postIds must be an array",
  });
  assert.deepEqual(parseImpressionPostIds({ postIds: ["not-a-uuid"] }), {
    error: "Invalid post id",
  });
});

test("rejects more than 50 ids", () => {
  const postIds = Array.from({ length: 51 }, (_, index) => {
    const hex = (index + 1).toString(16).padStart(12, "0");
    return `11111111-1111-4111-8111-${hex}`;
  });
  const parsed = parseImpressionPostIds({ postIds });
  assert.equal("error" in parsed, true);
});
