import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { pool } from "@vaara/db";
import { generateAnonymousHandle } from "../lib/anonymity.js";
import { buildAuthResponse } from "../lib/auth-response.js";
import { verifyGoogleIdToken } from "../lib/google-auth.js";

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

export function createAuthRoutes() {
  const app = new Hono();

  app.post("/register", async (c) => {
    const body = await c.req.json<{
      email?: string;
      password?: string;
      role?: "parent" | "provider";
      displayName?: string;
    }>();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const role = body.role ?? "parent";

    if (!email || !password || password.length < 8) {
      return c.json({ error: "Email and password (min 8 chars) required" }, 400);
    }

    if (role !== "parent" && role !== "provider") {
      return c.json({ error: "Invalid role" }, 400);
    }

    const client = await pool.connect();
    try {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [
        email,
      ]);
      if (existing.rows.length > 0) {
        return c.json({ error: "Email already registered" }, 409);
      }

      const handle = await generateUniqueHandle(client);
      const passwordHash = await bcrypt.hash(password, 10);
      const displayName = body.displayName?.trim() || null;

      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role, display_name, anonymous_handle)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, display_name, anonymous_handle, onboarding_complete`,
        [email, passwordHash, role, displayName, handle]
      );

      return c.json(await buildAuthResponse(rows[0]));
    } finally {
      client.release();
    }
  });

  app.post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400);
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete, password_hash
         FROM users WHERE email = $1`,
        [email]
      );

      if (rows.length === 0) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const user = rows[0];
      if (!user.password_hash) {
        return c.json(
          {
            error:
              "This account uses Google sign-in. Continue with Google instead.",
          },
          401
        );
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

  app.post("/google", async (c) => {
    const body = await c.req.json<{
      idToken?: string;
      role?: "parent" | "provider";
      displayName?: string;
    }>();

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
      body.displayName?.trim() || identity.name?.trim() || null;

    const client = await pool.connect();
    try {
      const byGoogle = await client.query(
        `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete
         FROM users WHERE google_sub = $1`,
        [identity.sub]
      );

      if (byGoogle.rows.length > 0) {
        return c.json(await buildAuthResponse(byGoogle.rows[0]));
      }

      const byEmail = await client.query(
        `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete, google_sub
         FROM users WHERE email = $1`,
        [identity.email]
      );

      if (byEmail.rows.length > 0) {
        const existing = byEmail.rows[0];
        if (existing.google_sub && existing.google_sub !== identity.sub) {
          return c.json({ error: "Email already linked to another Google account" }, 409);
        }

        const { rows } = await client.query(
          `UPDATE users
           SET google_sub = $2,
               display_name = COALESCE(display_name, $3),
               updated_at = now()
           WHERE id = $1
           RETURNING id, email, role, display_name, anonymous_handle, onboarding_complete`,
          [existing.id, identity.sub, displayName]
        );

        return c.json(await buildAuthResponse(rows[0]));
      }

      const handle = await generateUniqueHandle(client);
      const { rows } = await client.query(
        `INSERT INTO users (email, role, display_name, anonymous_handle, google_sub)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, display_name, anonymous_handle, onboarding_complete`,
        [identity.email, role, displayName, handle, identity.sub]
      );

      return c.json(await buildAuthResponse(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  return app;
}
