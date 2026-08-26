import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { pool } from "@vaara/db";
import { generateAnonymousHandle } from "../lib/anonymity.js";
import { signToken } from "../lib/jwt.js";

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
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        return c.json({ error: "Email already registered" }, 409);
      }

      let handle = generateAnonymousHandle();
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await client.query(
          "SELECT id FROM users WHERE anonymous_handle = $1",
          [handle]
        );
        if (clash.rows.length === 0) break;
        handle = generateAnonymousHandle();
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const displayName = body.displayName?.trim() || null;

      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role, display_name, anonymous_handle)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, display_name, anonymous_handle, onboarding_complete`,
        [email, passwordHash, role, displayName, handle]
      );

      const user = rows[0];
      const token = await signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return c.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          anonymousHandle: user.anonymous_handle,
          onboardingComplete: user.onboarding_complete,
        },
      });
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
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const token = await signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return c.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          anonymousHandle: user.anonymous_handle,
          onboardingComplete: user.onboarding_complete,
        },
      });
    } finally {
      client.release();
    }
  });

  return app;
}
