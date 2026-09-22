import { getRedis, isRedisEnabled } from "./client.js";

const FEED_TTL_SECONDS = Number(process.env.FEED_CACHE_TTL_SECONDS ?? 120);

export const PAGE_CACHE_TTL = {
  family: Number(process.env.FAMILY_PAGE_CACHE_TTL_SECONDS ?? 60),
  discover: Number(process.env.DISCOVER_CACHE_TTL_SECONDS ?? 90),
  pathTree: Number(process.env.PATH_TREE_CACHE_TTL_SECONDS ?? 1800),
  curricula: Number(process.env.CURRICULA_CACHE_TTL_SECONDS ?? 86400),
  chat: Number(process.env.CHAT_PAGE_CACHE_TTL_SECONDS ?? 3600),
} as const;

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

function cacheToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function familyPageKey(userId: string): string {
  return `page:family:v1:${userId}`;
}

export function discoverPageKey(params: {
  pin: string;
  boards: string;
  providerType?: string;
  category?: string;
  q?: string;
  sort: string;
  verifiedOnly: boolean;
}): string {
  return [
    "page:discover:v1",
    cacheToken(params.pin),
    cacheToken(params.boards || "any"),
    cacheToken(params.providerType || "all"),
    cacheToken(params.category || "all"),
    cacheToken(params.q || ""),
    cacheToken(params.sort),
    params.verifiedOnly ? "1" : "0",
  ].join(":");
}

export function pathTreeKey(params: {
  family: string;
  curriculumCode: string;
  gradeCode: string | null;
  stage: string;
  includeAfter10Fork: boolean;
  stateCode: string | null;
}): string {
  return [
    "page:path:v1",
    cacheToken(params.family),
    cacheToken(params.curriculumCode),
    cacheToken(params.gradeCode || "none"),
    cacheToken(params.stage),
    params.includeAfter10Fork ? "1" : "0",
    cacheToken(params.stateCode || "IN"),
  ].join(":");
}

export function curriculaPageKey(): string {
  return "page:curricula:v1";
}

export function chatLinearPageKey(circleId: string): string {
  return `chat:linear:v1:${circleId}`;
}

export function chatThreadPageKey(threadId: string): string {
  return `chat:thread:v1:${threadId}`;
}

export async function invalidateChatMessagePages(params: {
  circleIds?: string[];
  threadIds?: Array<string | null | undefined>;
}): Promise<void> {
  const keys = [
    ...(params.circleIds ?? []).map(chatLinearPageKey),
    ...[...new Set((params.threadIds ?? []).filter(Boolean) as string[])].map(
      chatThreadPageKey
    ),
  ];
  await deleteCachedKeys([...new Set(keys)]);
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

export async function deleteCachedKeys(keys: string[]): Promise<void> {
  if (!isRedisEnabled() || keys.length === 0) return;
  try {
    await getRedis().del(...keys);
  } catch (error) {
    console.error("[redis:cache] del failed", (error as Error).message);
  }
}

export async function invalidateFamilyPage(userId: string): Promise<void> {
  await deleteCachedKeys([familyPageKey(userId)]);
}

export async function invalidateDiscoverForPins(pins: string[]): Promise<void> {
  const unique = [...new Set(pins.map((pin) => pin.trim()).filter(Boolean))];
  await Promise.all(
    unique.map((pin) => deleteByPattern(`page:discover:v1:${cacheToken(pin)}:*`))
  );
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
  if (!isRedisEnabled()) return;
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
