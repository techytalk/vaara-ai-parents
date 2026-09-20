import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
import { pool } from "@vaara/db";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

export type AuthVariables = {
  user: JwtPayload;
};

export async function authMiddleware(
  c: Context<{ Variables: AuthVariables }>,
  next: Next
) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    const user = await verifyToken(token);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT session_version, is_internal, internal_status
         FROM users WHERE id = $1`,
        [user.sub]
      );
      if (rows.length === 0) {
        throw new HTTPException(401, { message: "Invalid token" });
      }
      const row = rows[0];
      if (Number(row.session_version ?? 0) !== Number(user.sessionVersion ?? 0)) {
        throw new HTTPException(401, { message: "Session expired" });
      }
      if (row.is_internal === true && row.internal_status === "inactive") {
        throw new HTTPException(401, { message: "Account deactivated" });
      }
    } finally {
      client.release();
    }
    c.set("user", user);
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
}
