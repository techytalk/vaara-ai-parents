import { getRedis, isRedisEnabled } from "./client.js";

const FEED_TTL_SECONDS = Number(process.env.FEED_CACHE_TTL_SECONDS ?? 120);

export function feedCacheKey(params: {
  circleId: string;
  userId: string;
  scope: string;
  cursor?: string | null;
}): string {
  const cursorPart = params.cursor ? `:${params.cursor}` : ":page1";
  return `feed:v1:${params.circleId}:${params.userId}:${params.scope}${cursorPart}`;
}

export function topicFeedCacheKey(params: {
  slug: string;
  userId: string;
  cursor?: string | null;
}): string {
  const cursorPart = params.cursor ? `:${params.cursor}` : ":page1";
  return `topic-feed:v1:${params.slug}:${params.userId}${cursorPart}`;
}

// A cache outage must never fail a request, so every helper degrades to the
// uncached path instead of propagating Redis errors.
export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null;
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds = FEED_TTL_SECONDS
): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error("[redis:cache] set failed", (error as Error).message);
  }
}

export async function invalidateCircleFeedCache(circleId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  await deleteByPattern(`feed:v1:${circleId}:*`);
}

export async function invalidateTopicFeedCache(slug: string): Promise<void> {
  if (!isRedisEnabled()) return;
  await deleteByPattern(`topic-feed:v1:${slug}:*`);
}

async function deleteByPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error("[redis:cache] invalidate failed", (error as Error).message);
  }
}
