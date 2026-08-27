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

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null;
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
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
  await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function invalidateCircleFeedCache(circleId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const pattern = `feed:v1:${circleId}:*`;
  await deleteByPattern(pattern);
}

export async function invalidateTopicFeedCache(slug: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const pattern = `topic-feed:v1:${slug}:*`;
  await deleteByPattern(pattern);
}

async function deleteByPattern(pattern: string): Promise<void> {
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
}
