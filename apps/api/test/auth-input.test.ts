import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidEmail,
  normalizeDisplayName,
  normalizeEmail,
  passwordError,
} from "@vaara/shared/auth-input";

describe("auth input", () => {
  it("rejects names, pins, and other non-emails", () => {
    assert.equal(isValidEmail("8986"), false);
    assert.equal(isValidEmail("kalpana 1gw1"), false);
    assert.equal(isValidEmail("Kalpana"), false);
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidEmail("a@b"), false);
    assert.equal(isValidEmail(""), false);
  });

  it("accepts normal and Apple private-relay emails", () => {
    assert.equal(isValidEmail("you@example.com"), true);
    assert.equal(isValidEmail("  You@Example.COM  "), true);
    assert.equal(
      isValidEmail("abc@privaterelay.appleid.com"),
      true
    );
    assert.equal(normalizeEmail("  You@Example.COM  "), "you@example.com");
  });

  it("caps display names and passwords", () => {
    assert.equal(normalizeDisplayName("  Kalpana   Reddy  "), "Kalpana Reddy");
    assert.ok(passwordError("short"));
    assert.equal(passwordError("abcdef"), null);
    assert.equal(passwordError("longenough"), null);
    assert.ok(passwordError("x".repeat(73)));
  });
});
