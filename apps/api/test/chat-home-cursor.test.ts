import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeChatHomeCursor,
  isAfterChatHomeCursor,
  parseChatHomeCursor,
} from "../src/lib/chat-home-cursor.js";

test("chat home cursor encodes bucket, time, and id", () => {
  const encoded = encodeChatHomeCursor({
    bucket: 2,
    lastAt: "2026-09-17T00:00:00.000Z",
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  });
  const parsed = parseChatHomeCursor(encoded);
  assert.equal(parsed?.bucket, 2);
  assert.equal(parsed?.lastAt, "2026-09-17T00:00:00.000Z");
  assert.equal(parsed?.id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
});

test("chat home page walks bucket then older lastAt", () => {
  const cursor = {
    bucket: 1,
    lastAt: "2026-09-17T12:00:00.000Z",
    id: "b",
  };
  assert.equal(
    isAfterChatHomeCursor(
      { bucket: 1, lastAt: "2026-09-17T11:00:00.000Z", id: "a" },
      cursor
    ),
    true
  );
  assert.equal(
    isAfterChatHomeCursor(
      { bucket: 1, lastAt: "2026-09-17T13:00:00.000Z", id: "c" },
      cursor
    ),
    false
  );
  assert.equal(
    isAfterChatHomeCursor(
      { bucket: 2, lastAt: "2026-09-17T20:00:00.000Z", id: "z" },
      cursor
    ),
    true
  );
});
