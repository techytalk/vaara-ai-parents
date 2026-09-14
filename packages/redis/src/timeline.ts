import { getRedis, isRedisEnabled } from "./client.js";

export const CIRCLE_TIMELINE_MAX = Number(
  process.env.CIRCLE_TIMELINE_MAX ?? 500
);

export type TimelineEntry = {
  postId: string;
  scoreMs: number;
};

export type TimelineMeta = {
  ready: boolean;
  maxAt: string | null;
  maxId: string | null;
  count: number;
};

export function circleTimelineKey(circleId: string) {
  return `timeline:v1:${circleId}`;
}

export function circleTimelineMetaKey(circleId: string) {
  return `timeline:v1:${circleId}:meta`;
}

export function circleTimelineLockKey(circleId: string) {
  return `timeline:v1:${circleId}:lock`;
}

export function createdAtToScoreMs(createdAt: string | Date): number {
  const ms =
    createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : 0;
}

export async function getCircleTimelineMeta(
  circleId: string
): Promise<TimelineMeta | null> {
  if (!isRedisEnabled()) return null;
  try {
    const raw = await getRedis().hgetall(circleTimelineMetaKey(circleId));
    if (!raw || raw.ready !== "1") return null;
    return {
      ready: true,
      maxAt: raw.maxAt || null,
      maxId: raw.maxId || null,
      count: Number(raw.count ?? 0),
    };
  } catch (error) {
    console.error("[redis:timeline] meta failed", (error as Error).message);
    return null;
  }
}

export async function setCircleTimelineMeta(
  circleId: string,
  meta: { maxAt?: string | null; maxId?: string | null; count?: number }
): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    const redis = getRedis();
    const current = await redis.zcard(circleTimelineKey(circleId));
    await redis.hset(circleTimelineMetaKey(circleId), {
      ready: "1",
      maxAt: meta.maxAt ?? "",
      maxId: meta.maxId ?? "",
      count: String(meta.count ?? current),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[redis:timeline] set meta failed", (error as Error).message);
  }
}

export async function acquireCircleTimelineLock(
  circleId: string,
  ttlSeconds = 30
): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const result = await getRedis().set(
      circleTimelineLockKey(circleId),
      "1",
      "EX",
      ttlSeconds,
      "NX"
    );
    return result === "OK";
  } catch (error) {
    console.error("[redis:timeline] lock failed", (error as Error).message);
    return false;
  }
}

export async function releaseCircleTimelineLock(circleId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().del(circleTimelineLockKey(circleId));
  } catch (error) {
    console.error("[redis:timeline] unlock failed", (error as Error).message);
  }
}

export async function addPostToCircleTimeline(params: {
  circleId: string;
  postId: string;
  createdAt: string | Date;
}): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const redis = getRedis();
    const key = circleTimelineKey(params.circleId);
    const score = createdAtToScoreMs(params.createdAt);
    await redis.zadd(key, score, params.postId);
    await redis.zremrangebyrank(key, 0, -(CIRCLE_TIMELINE_MAX + 1));
    const count = await redis.zcard(key);
    const iso =
      params.createdAt instanceof Date
        ? params.createdAt.toISOString()
        : params.createdAt;
    const meta = await getCircleTimelineMeta(params.circleId);
    if (meta) {
      const newer =
        !meta.maxAt ||
        score > createdAtToScoreMs(meta.maxAt) ||
        (score === createdAtToScoreMs(meta.maxAt) &&
          params.postId > (meta.maxId ?? ""));
      await setCircleTimelineMeta(params.circleId, {
        maxAt: newer ? iso : meta.maxAt,
        maxId: newer ? params.postId : meta.maxId,
        count,
      });
    }
    return true;
  } catch (error) {
    console.error("[redis:timeline] zadd failed", (error as Error).message);
    return false;
  }
}

export async function removePostFromCircleTimeline(params: {
  circleId: string;
  postId: string;
}): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const redis = getRedis();
    await redis.zrem(circleTimelineKey(params.circleId), params.postId);
    const meta = await getCircleTimelineMeta(params.circleId);
    if (meta) {
      const count = await redis.zcard(circleTimelineKey(params.circleId));
      await setCircleTimelineMeta(params.circleId, {
        maxAt: meta.maxAt,
        maxId: meta.maxId,
        count,
      });
    }
    return true;
  } catch (error) {
    console.error("[redis:timeline] zrem failed", (error as Error).message);
    return false;
  }
}

export async function listCircleTimeline(params: {
  circleId: string;
  maxScore?: number | "+inf";
  limit: number;
}): Promise<TimelineEntry[]> {
  if (!isRedisEnabled()) return [];
  try {
    const max = params.maxScore ?? "+inf";
    const rows = await getRedis().zrevrangebyscore(
      circleTimelineKey(params.circleId),
      max,
      "-inf",
      "WITHSCORES",
      "LIMIT",
      0,
      params.limit
    );
    const entries: TimelineEntry[] = [];
    for (let i = 0; i < rows.length; i += 2) {
      entries.push({
        postId: rows[i],
        scoreMs: Number(rows[i + 1]),
      });
    }
    return entries;
  } catch (error) {
    console.error("[redis:timeline] list failed", (error as Error).message);
    return [];
  }
}

export async function listManyCircleTimelinesFromCursor(params: {
  circleIds: string[];
  maxScore?: number | "+inf";
  limitPerCircle: number;
}): Promise<Map<string, TimelineEntry[]>> {
  const result = new Map<string, TimelineEntry[]>();
  if (!isRedisEnabled() || params.circleIds.length === 0) return result;
  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    for (const circleId of params.circleIds) {
      pipeline.zrevrangebyscore(
        circleTimelineKey(circleId),
        params.maxScore ?? "+inf",
        "-inf",
        "WITHSCORES",
        "LIMIT",
        0,
        params.limitPerCircle
      );
    }
    const replies = await pipeline.exec();
    params.circleIds.forEach((circleId, index) => {
      const reply = replies?.[index];
      const rows = (reply?.[1] as string[] | undefined) ?? [];
      const entries: TimelineEntry[] = [];
      if (!reply?.[0]) {
        for (let i = 0; i < rows.length; i += 2) {
          entries.push({
            postId: rows[i],
            scoreMs: Number(rows[i + 1]),
          });
        }
      }
      result.set(circleId, entries);
    });
    return result;
  } catch (error) {
    console.error("[redis:timeline] pipeline failed", (error as Error).message);
    return result;
  }
}

export async function backfillCircleTimeline(
  circleId: string,
  rows: Array<{ postId: string; createdAt: string | Date }>
): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const redis = getRedis();
    const key = circleTimelineKey(circleId);
    if (rows.length > 0) {
      const args: Array<number | string> = [];
      for (const row of rows) {
        args.push(createdAtToScoreMs(row.createdAt), row.postId);
      }
      await redis.zadd(key, ...args);
      await redis.zremrangebyrank(key, 0, -(CIRCLE_TIMELINE_MAX + 1));
    }
    const newest = rows[0];
    await setCircleTimelineMeta(circleId, {
      maxAt: newest
        ? newest.createdAt instanceof Date
          ? newest.createdAt.toISOString()
          : String(newest.createdAt)
        : null,
      maxId: newest?.postId ?? null,
      count: await redis.zcard(key),
    });
    return true;
  } catch (error) {
    console.error("[redis:timeline] backfill failed", (error as Error).message);
    return false;
  }
}

export function afterExclusiveCursor(
  entries: TimelineEntry[],
  cursor?: { createdAt: string; postId?: string } | null
): TimelineEntry[] {
  if (!cursor) return entries;
  const cursorMs = createdAtToScoreMs(cursor.createdAt);
  return entries.filter((entry) => {
    if (entry.scoreMs < cursorMs) return true;
    if (entry.scoreMs > cursorMs) return false;
    if (!cursor.postId) return false;
    return entry.postId < cursor.postId && entry.postId !== cursor.postId;
  });
}
