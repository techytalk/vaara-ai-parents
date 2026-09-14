import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeHomeFeedCursor,
  encodeHomeFeedCursorV2,
  isLegacyHomeCursor,
  nextFreshnessPhase,
  parseHomeFeedCursor,
} from "../src/lib/feed-cursor.js";

test("parses legacy home cursors", () => {
  const primary = parseHomeFeedCursor(
    encodeHomeFeedCursor("primary", "2026-09-14T01:00:00.000Z", "11111111-1111-4111-8111-111111111111")
  );
  assert.equal(primary.phase, "primary");
  assert.equal(primary.version, 1);
  assert.equal(primary.postId, "11111111-1111-4111-8111-111111111111");
  assert.equal(isLegacyHomeCursor("p|2026-09-14T01:00:00.000Z|abc"), true);
});

test("round-trips v2 freshness cursors", () => {
  const encoded = encodeHomeFeedCursorV2({
    phase: "discovery_unseen",
    asOf: "2026-09-14T02:00:00.000Z",
    createdAt: "2026-09-14T01:12:56.427Z",
    postId: "22222222-2222-4222-8222-222222222222",
    relevance: 1,
    helpfulCount: 3,
  });
  assert.equal(encoded.startsWith("v2."), true);
  assert.equal(isLegacyHomeCursor(encoded), false);
  const parsed = parseHomeFeedCursor(encoded);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.phase, "discovery_unseen");
  assert.equal(parsed.asOf, "2026-09-14T02:00:00.000Z");
  assert.equal(parsed.relevance, 1);
  assert.equal(parsed.helpfulCount, 3);
});

test("walks freshness phases in order", () => {
  assert.equal(nextFreshnessPhase("member_unseen"), "discovery_unseen");
  assert.equal(nextFreshnessPhase("discovery_unseen"), "member_seen");
  assert.equal(nextFreshnessPhase("member_seen"), "discovery_seen");
  assert.equal(nextFreshnessPhase("discovery_seen"), null);
});
