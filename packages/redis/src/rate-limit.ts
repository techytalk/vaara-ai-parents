import { getRedis, isRedisEnabled } from "./client.js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export async function checkRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  if (!isRedisEnabled()) {
    return {
      allowed: true,
      remaining: params.limit,
      resetAt: Date.now() + params.windowSeconds * 1000,
    };
  }

  const redis = getRedis();
  const now = Date.now();
  const bucket = `${params.key}:${Math.floor(now / (params.windowSeconds * 1000))}`;
  const count = await redis.incr(bucket);

  if (count === 1) {
    await redis.expire(bucket, params.windowSeconds);
  }

  const remaining = Math.max(params.limit - count, 0);
  const resetAt =
    Math.ceil(now / (params.windowSeconds * 1000)) *
      params.windowSeconds *
      1000;

  return {
    allowed: count <= params.limit,
    remaining,
    resetAt,
  };
}
