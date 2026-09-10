import assert from "node:assert/strict";
import test from "node:test";
import {
  getAppleAudiences,
  parseAppleTokenPayload,
} from "../src/lib/apple-auth.js";

test("parses a first-time Apple identity token payload", () => {
  const identity = parseAppleTokenPayload({
    sub: "001234.abc",
    email: "parent@privaterelay.appleid.com",
    email_verified: "true",
    is_private_email: "true",
  });

  assert.deepEqual(identity, {
    sub: "001234.abc",
    email: "parent@privaterelay.appleid.com",
    emailVerified: true,
    isPrivateEmail: true,
  });
});

test("allows returning Apple users without an email claim", () => {
  const identity = parseAppleTokenPayload({
    sub: "001234.abc",
  });

  assert.equal(identity.email, null);
  assert.equal(identity.emailVerified, false);
});

test("rejects Apple tokens without a subject", () => {
  assert.throws(() => parseAppleTokenPayload({}), /Invalid Apple token payload/);
});

test("always accepts the iOS bundle id as an Apple audience", () => {
  assert.ok(getAppleAudiences().includes("com.vaara.parents"));
});
