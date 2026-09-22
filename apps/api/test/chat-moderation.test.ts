import assert from "node:assert/strict";
import test from "node:test";
import { MODERATED_MESSAGE_COPY } from "../src/lib/chat-copy.js";
import { parseMessageIds } from "../src/services/chat-moderation.js";

test("moderated tombstone copy is short for mobile bubbles", () => {
  assert.equal(MODERATED_MESSAGE_COPY, "Blocked as inappropriate");
  assert.ok(MODERATED_MESSAGE_COPY.length < 40);
});

test("parseMessageIds rejects empty and invalid input", () => {
  assert.equal((parseMessageIds(undefined) as { error: string }).error, "messageIds is required");
  assert.equal((parseMessageIds([]) as { error: string }).error, "messageIds is required");
  assert.equal(
    (parseMessageIds(["not-a-uuid"]) as { error: string }).error,
    "Invalid message id"
  );
});

test("parseMessageIds de-dupes valid ids", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const parsed = parseMessageIds([id, id, ` ${id} `]);
  assert.deepEqual(parsed, [id]);
});
