import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { pool } from "@vaara/db";
import {
  isValidEmail,
  normalizeDisplayName,
  normalizeEmail,
  passwordError,
} from "@vaara/shared/auth-input";
import { generateAnonymousHandle } from "../lib/anonymity.js";
import { defaultAvatarKeyForHandle } from "../lib/avatar.js";
import { verifyAppleIdentityToken } from "../lib/apple-auth.js";
import { buildAuthResponse } from "../lib/auth-response.js";
import { verifyGoogleIdToken } from "../lib/google-auth.js";
import {
  clientIp,
  rateLimitMiddleware,
} from "../middleware/rate-limit.js";

async function generateUniqueHandle(client: PoolClient): Promise<string> {
  let handle = generateAnonymousHandle();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await client.query(
      "SELECT id FROM users WHERE anonymous_handle = $1",
      [handle]
    );
    if (clash.rows.length === 0) return handle;
    handle = generateAnonymousHandle();
  }
  return handle;
}

const AUTH_USER_COLS =
  `id, email, role, display_name, anonymous_handle, onboarding_complete, avatar_key, session_version, is_internal, internal_status`;

function rejectIfInactive(
  user: { is_internal?: boolean; internal_status?: string }
): { error: string } | null {
  if (user.is_internal === true && user.internal_status === "inactive") {
    return { error: "Account deactivated" };
  }
  return null;
}

async function readJson<T>(c: {
  req: { json: () => Promise<unknown> };
}): Promise<T | null> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return null;
  }
}

export function createAuthRoutes() {
  const app = new Hono();
  const registerLimit = rateLimitMiddleware({
    prefix: "auth-register",
    limit: 8,
    windowSeconds: 60 * 60,
    keyFn: clientIp,
  });
  const loginLimit = rateLimitMiddleware({
    prefix: "auth-login",
    limit: 20,
    windowSeconds: 15 * 60,
    keyFn: clientIp,
  });
  const oauthLimit = rateLimitMiddleware({
    prefix: "auth-oauth",
    limit: 30,
    windowSeconds: 15 * 60,
    keyFn: clientIp,
  });

  app.post("/register", registerLimit, async (c) => {
    const body = await readJson<{
      email?: string;
      password?: string;
      role?: "parent" | "provider";
      displayName?: string;
    }>(c);
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const email = normalizeEmail(body.email);
    const password = body.password;
    const role = body.role ?? "parent";

    if (!isValidEmail(email)) {
      return c.json(
        { error: "Enter a valid email address, like you@example.com" },
        400
      );
    }

    const passwordProblem = passwordError(password);
    if (passwordProblem) {
      return c.json({ error: passwordProblem }, 400);
    }

    if (role !== "parent" && role !== "provider") {
      return c.json({ error: "Invalid role" }, 400);
    }

    const client = await pool.connect();
    try {
      const emailLookupStarted = performance.now();
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [
        email,
      ]);
      const emailLookupMs = performance.now() - emailLookupStarted;
      if (existing.rows.length > 0) {
        return c.json({ error: "Email already registered" }, 409);
      }

      const handleStarted = performance.now();
      const handle = await generateUniqueHandle(client);
      const handleMs = performance.now() - handleStarted;

      const hashStarted = performance.now();
      const passwordHash = await bcrypt.hash(password!, 10);
      const hashMs = performance.now() - hashStarted;

      const displayName = normalizeDisplayName(body.displayName);
      const avatarKey = defaultAvatarKeyForHandle(handle);

      const insertStarted = performance.now();
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role, display_name, anonymous_handle, avatar_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${AUTH_USER_COLS}`,
        [email, passwordHash, role, displayName, handle, avatarKey]
      );
      const insertMs = performance.now() - insertStarted;

      const jwtStarted = performance.now();
      const response = await buildAuthResponse(rows[0], { isNewUser: true });
      const jwtMs = performance.now() - jwtStarted;

      console.info(
        JSON.stringify({
          event: "auth.register.timing",
          emailLookupMs: Math.round(emailLookupMs),
          handleMs: Math.round(handleMs),
          hashMs: Math.round(hashMs),
          insertMs: Math.round(insertMs),
          jwtMs: Math.round(jwtMs),
        })
      );

      return c.json(response);
    } finally {
      client.release();
    }
  });

  app.post("/login", loginLimit, async (c) => {
    const body = await readJson<{ email?: string; password?: string }>(c);
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const email = normalizeEmail(body.email);
    const password = body.password;

    if (!isValidEmail(email) || !password) {
      return c.json({ error: "Email and password required" }, 400);
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete, avatar_key, password_hash, google_sub, apple_sub,
                session_version, is_internal, internal_status
         FROM users WHERE email = $1`,
        [email]
      );

      if (rows.length === 0) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const user = rows[0];
      if (user.is_internal === true && user.internal_status === "inactive") {
        return c.json({ error: "Account deactivated" }, 401);
      }
      if (!user.password_hash) {
        const usesApple = Boolean(user.apple_sub);
        const usesGoogle = Boolean(user.google_sub);
        const error =
          usesApple && usesGoogle
            ? "This account uses Apple or Google sign-in. Continue with Apple or Google instead."
            : usesApple
              ? "This account uses Apple sign-in. Continue with Apple instead."
              : "This account uses Google sign-in. Continue with Google instead.";
        return c.json({ error }, 401);
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      return c.json(await buildAuthResponse(user));
    } finally {
      client.release();
    }
  });

  app.post("/google", oauthLimit, async (c) => {
    const body = await readJson<{
      idToken?: string;
      role?: "parent" | "provider";
      displayName?: string;
    }>(c);
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.idToken) {
      return c.json({ error: "idToken is required" }, 400);
    }

    let identity;
    try {
      identity = await verifyGoogleIdToken(body.idToken);
    } catch {
      return c.json({ error: "Invalid Google sign-in" }, 401);
    }

    if (!identity.emailVerified) {
      return c.json({ error: "Google email must be verified" }, 400);
    }

    const role = body.role === "provider" ? "provider" : "parent";
    const displayName =
      normalizeDisplayName(body.displayName) ||
      normalizeDisplayName(identity.name);

    const client = await pool.connect();
    try {
      const byGoogle = await client.query(
        `SELECT ${AUTH_USER_COLS}
         FROM users WHERE google_sub = $1`,
        [identity.sub]
      );

      if (byGoogle.rows.length > 0) {
        const blocked = rejectIfInactive(byGoogle.rows[0]);
        if (blocked) return c.json(blocked, 401);
        return c.json(await buildAuthResponse(byGoogle.rows[0], { isNewUser: false }));
      }

      const byEmail = await client.query(
        `SELECT ${AUTH_USER_COLS}, google_sub
         FROM users WHERE email = $1`,
        [identity.email]
      );

      if (byEmail.rows.length > 0) {
        const existing = byEmail.rows[0];
        const blocked = rejectIfInactive(existing);
        if (blocked) return c.json(blocked, 401);
        if (existing.google_sub && existing.google_sub !== identity.sub) {
          return c.json({ error: "Email already linked to another Google account" }, 409);
        }

        const { rows } = await client.query(
          `UPDATE users
           SET google_sub = $2,
               display_name = COALESCE(display_name, $3),
               updated_at = now()
           WHERE id = $1
           RETURNING ${AUTH_USER_COLS}`,
          [existing.id, identity.sub, displayName]
        );

        return c.json(await buildAuthResponse(rows[0], { isNewUser: false }));
      }

      const handle = await generateUniqueHandle(client);
      const avatarKey = defaultAvatarKeyForHandle(handle);
      const { rows } = await client.query(
        `INSERT INTO users (email, role, display_name, anonymous_handle, google_sub, avatar_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${AUTH_USER_COLS}`,
        [identity.email, role, displayName, handle, identity.sub, avatarKey]
      );

      return c.json(await buildAuthResponse(rows[0], { isNewUser: true }), 201);
    } finally {
      client.release();
    }
  });

  app.post("/apple", oauthLimit, async (c) => {
    const body = await readJson<{
      identityToken?: string;
      role?: "parent" | "provider";
      displayName?: string;
    }>(c);
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.identityToken) {
      return c.json({ error: "idToken is required" }, 400);
    }

    let identity;
    try {
      identity = await verifyAppleIdentityToken(body.identityToken);
    } catch {
      return c.json({ error: "Invalid Apple sign-in" }, 401);
    }

    const role = body.role === "provider" ? "provider" : "parent";
    const displayName = normalizeDisplayName(body.displayName);

    const client = await pool.connect();
    try {
      const byApple = await client.query(
        `SELECT ${AUTH_USER_COLS}
         FROM users WHERE apple_sub = $1`,
        [identity.sub]
      );

      if (byApple.rows.length > 0) {
        const blocked = rejectIfInactive(byApple.rows[0]);
        if (blocked) return c.json(blocked, 401);
        return c.json(await buildAuthResponse(byApple.rows[0], { isNewUser: false }));
      }

      if (!identity.email) {
        return c.json(
          {
            error:
              "Apple did not share an email. Share your email with Vaara or sign in another way.",
          },
          400
        );
      }

      const byEmail = await client.query(
        `SELECT ${AUTH_USER_COLS}, apple_sub
         FROM users WHERE email = $1`,
        [identity.email]
      );

      if (byEmail.rows.length > 0) {
        const existing = byEmail.rows[0];
        const blocked = rejectIfInactive(existing);
        if (blocked) return c.json(blocked, 401);
        if (existing.apple_sub && existing.apple_sub !== identity.sub) {
          return c.json(
            { error: "Email already linked to another Apple account" },
            409
          );
        }

        const { rows } = await client.query(
          `UPDATE users
           SET apple_sub = $2,
               display_name = COALESCE(display_name, $3),
               updated_at = now()
           WHERE id = $1
           RETURNING ${AUTH_USER_COLS}`,
          [existing.id, identity.sub, displayName]
        );

        return c.json(await buildAuthResponse(rows[0], { isNewUser: false }));
      }

      const handle = await generateUniqueHandle(client);
      const avatarKey = defaultAvatarKeyForHandle(handle);
      const { rows } = await client.query(
        `INSERT INTO users (email, role, display_name, anonymous_handle, apple_sub, avatar_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${AUTH_USER_COLS}`,
        [identity.email, role, displayName, handle, identity.sub, avatarKey]
      );

      return c.json(await buildAuthResponse(rows[0], { isNewUser: true }), 201);
    } finally {
      client.release();
    }
  });

  return app;
}
