import assert from "node:assert/strict";
import test from "node:test";
import {
  detectObjectionableContent,
  rejectObjectionableText,
} from "../src/lib/content-guard.js";

test("allows ordinary parent posts", () => {
  const result = detectObjectionableContent(
    "Does anyone have a recommendation for a maths tutor in IB Year 5?"
  );
  assert.equal(result.blocked, false);
});

test("blocks pornographic content", () => {
  const result = detectObjectionableContent("Check this porn link");
  assert.equal(result.blocked, true);
});

test("blocks hate speech", () => {
  const result = detectObjectionableContent("That parent is a retard");
  assert.equal(result.blocked, true);
});

test("combines poll text when rejecting", () => {
  const rejected = rejectObjectionableText("Hello parents", "nude pics?");
  assert.ok(rejected?.error);
});
