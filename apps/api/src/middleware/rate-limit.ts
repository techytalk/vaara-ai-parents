import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
import { checkRateLimit } from "@vaara/redis";
import type { AuthVariables } from "./auth.js";

type RateLimitOptions = {
  prefix: string;
  limit: number;
  windowSeconds: number;
  keyFn?: (c: Context<{ Variables: AuthVariables }>) => string;
};

/** Visitor public IP as Vercel reports it (first hop in X-Forwarded-For). */
export function clientIp(c: Context): string {
  const forwarded =
    c.req.header("x-vercel-forwarded-for") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "anon";
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const userId = c.get("user")?.sub;
    const key = options.keyFn?.(c) ?? userId ?? clientIp(c);
    const result = await checkRateLimit({
      key: `rl:${options.prefix}:${key}`,
      limit: options.limit,
      windowSeconds: options.windowSeconds,
    });

    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      throw new HTTPException(429, { message: "Too many requests" });
    }

    await next();
  };
}
