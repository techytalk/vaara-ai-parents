import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
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
    c.set("user", user);
    await next();
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
}
