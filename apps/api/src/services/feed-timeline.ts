import type { PoolClient } from "pg";
import { pool, readPool } from "@vaara/db";
import {
  CIRCLE_TIMELINE_MAX,
  acquireCircleTimelineLock,
  afterExclusiveCursor,
  backfillCircleTimeline,
  createdAtToScoreMs,
  getCircleTimelineMeta,
  isRedisEnabled,
  listCircleTimeline,
  listManyCircleTimelinesFromCursor,
  releaseCircleTimelineLock,
  type TimelineEntry,
} from "@vaara/redis";
import { assertCircleMember } from "../lib/author.js";
import {
  encodeFeedCursor,
  encodeHomeFeedCursor,
  parseFeedCursor,
  parseHomeFeedCursor,
  toIsoTimestamp,
  type FeedCursor,
} from "../lib/feed-cursor.js";
import {
  circleTimelineMode,
  homeFeedFreshnessEnabled,
  homeTimelineMode,
} from "../lib/timeline-mode.js";
import {
  hydrateCirclePosts,
  hydrateHomeRows,
  loadCircleFeed,
  loadDiscoveryHomeRows,
  loadHomeFeed,
  loadMemberHomeRows,
  type CircleFeedResult,
  type HomeFeedResult,
} from "./feed.js";
import { applyTimelineWrites } from "./timeline-outbox.js";

const CIRCLE_RANK: Record<string, number> = {
  school_class: 1,
  school_age: 1,
  class: 2,
  school: 3,
  age_locality: 4,
  community: 5,
  locality: 6,
  curriculum: 7,
};

function circleRank(type: string) {
  return CIRCLE_RANK[type] ?? 7;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadLatestCircleTimelineRows(
  client: PoolClient,
  circleId: string,
  limit = CIRCLE_TIMELINE_MAX
): Promise<Array<{ postId: string; createdAt: string }>> {
  const { rows } = await client.query(
    `SELECT pct.post_id AS id, pct.post_created_at AS created_at
     FROM circle_post_targets pct
     WHERE pct.circle_id = $1
     ORDER BY pct.post_created_at DESC, pct.post_id DESC
     LIMIT $2`,
    [circleId, limit]
  );
  return rows.map((row) => ({
    postId: String(row.id),
    createdAt: toIsoTimestamp(row.created_at),
  }));
}

async function backfillCircle(circleId: string): Promise<boolean> {
  const locked = await acquireCircleTimelineLock(circleId);
  if (!locked) {
    console.log("[timeline.backfill.lock_miss]", { circleId });
    for (let i = 0; i < 3; i += 1) {
      await sleep(50);
      if (await getCircleTimelineMeta(circleId)) return true;
    }
    return false;
  }
  const started = Date.now();
  const client = await pool.connect();
  try {
    const rows = await loadLatestCircleTimelineRows(client, circleId);
    const ok = await backfillCircleTimeline(circleId, rows);
    console.log("[timeline.backfill.ms]", {
      circleId,
      ms: Date.now() - started,
      count: rows.length,
    });
    return ok;
  } finally {
    client.release();
    await releaseCircleTimelineLock(circleId);
  }
}

async function authorsSharingPin(
  client: PoolClient,
  viewerId: string,
  authorIds: string[]
): Promise<Set<string>> {
  const allowed = new Set<string>([viewerId]);
  if (authorIds.length === 0) return allowed;
  const { rows } = await client.query(
    `SELECT DISTINCT author_loc.user_id
     FROM user_locations viewer_loc
     JOIN user_locations author_loc
       ON author_loc.pin_code = viewer_loc.pin_code
     WHERE viewer_loc.user_id = $1
       AND author_loc.user_id = ANY($2::uuid[])`,
    [viewerId, authorIds]
  );
  for (const row of rows) allowed.add(String(row.user_id));
  return allowed;
}

async function walkCircleTimelineIds(params: {
  circleId: string;
  cursor: FeedCursor | null;
  need: number;
}): Promise<{ entries: TimelineEntry[]; exhausted: boolean }> {
  const collected: TimelineEntry[] = [];
  let cursor = params.cursor;
  let exhausted = false;
  while (collected.length < params.need && !exhausted) {
    const raw = await listCircleTimeline({
      circleId: params.circleId,
      maxScore: cursor ? createdAtToScoreMs(cursor.createdAt) : "+inf",
      limit: Math.min(80, Math.max(params.need * 4, 20)),
    });
    const filtered = afterExclusiveCursor(raw, cursor);
    if (filtered.length === 0) {
      exhausted = true;
      break;
    }
    collected.push(...filtered);
    const last = filtered[filtered.length - 1];
    cursor = {
      createdAt: new Date(last.scoreMs).toISOString(),
      postId: last.postId,
    };
    if (raw.length < 20) exhausted = true;
  }
  return { entries: collected, exhausted };
}

export async function loadCircleFeedResolved(params: {
  userId: string;
  circleId: string;
  scope?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<CircleFeedResult | { error: "not_found" }> {
  const mode = circleTimelineMode();
  const useRedis = isRedisEnabled() && mode !== "off";
  if (!useRedis) {
    console.log("[feed.path=sql]", { surface: "circle" });
    return loadCircleFeed(params);
  }

  const redisResult = await loadCircleFeedFromTimeline(params);
  if ("error" in redisResult) return redisResult;

  if (mode === "shadow") {
    const sqlResult = await loadCircleFeed(params);
    if ("error" in sqlResult) return sqlResult;
    const sqlIds = sqlResult.posts.map((post) => post.id).join(",");
    const redisIds = redisResult.posts.map((post) => post.id).join(",");
    if (sqlIds !== redisIds) {
      console.error("[timeline.shadow.diff]", {
        surface: "circle",
        circleId: params.circleId,
        sqlIds,
        redisIds,
      });
    }
    console.log("[feed.path=shadow]", { surface: "circle" });
    return sqlResult;
  }

  console.log("[feed.path=redis]", { surface: "circle" });
  return redisResult;
}

export async function loadCircleFeedFromTimeline(params: {
  userId: string;
  circleId: string;
  scope?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<CircleFeedResult | { error: "not_found" }> {
  const scope = params.scope ?? "local";
  const limit = Math.min(params.limit ?? 20, 50);
  const cursor = parseFeedCursor(params.cursor);
  const client = await readPool.connect();

  try {
    const circle = await assertCircleMember(client, params.circleId, params.userId);
    if (!circle) return { error: "not_found" };

    let meta = await getCircleTimelineMeta(params.circleId);
    if (!meta) {
      const filled = await backfillCircle(params.circleId);
      meta = filled ? await getCircleTimelineMeta(params.circleId) : null;
      if (!meta) {
        console.log("[timeline.fallback.sql]", { reason: "cold" });
        return loadCircleFeed(params);
      }
    }

    if ((meta.count ?? 0) === 0) {
      return { posts: [], nextCursor: null };
    }

    const localFilter =
      circle.circle_type === "curriculum" && scope === "local";
    const { entries, exhausted } = await walkCircleTimelineIds({
      circleId: params.circleId,
      cursor,
      need: localFilter ? limit * 4 : limit,
    });

    const hydrated = await hydrateCirclePosts({
      client,
      userId: params.userId,
      circle,
      postIds: entries.map((entry) => entry.postId),
    });

    let visible = hydrated.posts;
    if (localFilter) {
      const allowed = await authorsSharingPin(
        client,
        params.userId,
        visible.map((post) => post.author.userId)
      );
      visible = visible.filter((post) => allowed.has(post.author.userId));
    }

    if (hydrated.missingIds.length > 0) {
      console.error("[timeline.hydrate.miss]", {
        circleId: params.circleId,
        missingIds: hydrated.missingIds,
      });
      await applyTimelineWrites({
        op: "remove",
        postId: hydrated.missingIds[0],
        circleIds: [params.circleId],
      });
    }

    const page = visible.slice(0, limit);
    if (page.length < limit && exhausted) {
      console.log("[timeline.fallback.sql]", { reason: "hot_window" });
      const tailCursor =
        page.length > 0
          ? encodeFeedCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
          : params.cursor;
      const sqlTail = await loadCircleFeed({
        ...params,
        cursor: tailCursor,
        limit: limit - page.length,
      });
      if (!("error" in sqlTail)) {
        const merged = [...page, ...sqlTail.posts];
        return {
          posts: merged,
          nextCursor:
            merged.length === 0
              ? null
              : sqlTail.nextCursor ??
                (merged.length >= limit
                  ? encodeFeedCursor(
                      merged[merged.length - 1].createdAt,
                      merged[merged.length - 1].id
                    )
                  : null),
        };
      }
    }

    const last = page[page.length - 1];
    return {
      posts: page,
      nextCursor:
        page.length === limit && last
          ? encodeFeedCursor(last.createdAt, last.id)
          : null,
    };
  } finally {
    client.release();
  }
}

export async function loadHomeFeedResolved(params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<HomeFeedResult> {
  const mode = homeTimelineMode();
  const useRedis =
    isRedisEnabled() && mode !== "off" && !homeFeedFreshnessEnabled();
  if (!useRedis) {
    console.log("[feed.path=sql]", { surface: "home" });
    return loadHomeFeed(params);
  }

  let redisResult: HomeFeedResult | null = null;
  try {
    redisResult = await loadHomeFeedFromTimeline(params);
  } catch (error) {
    console.error("[timeline.home.redis_failed]", error);
    if (mode !== "shadow") {
      console.log("[feed.path=sql]", { surface: "home", reason: "redis_failed" });
      return loadHomeFeed(params);
    }
  }

  if (mode === "shadow") {
    const sqlResult = await loadHomeFeed(params);
    if (redisResult) {
      const sqlIds = sqlResult.posts.map((post) => post.id).join(",");
      const redisIds = redisResult.posts.map((post) => post.id).join(",");
      if (sqlIds !== redisIds) {
        console.error("[timeline.shadow.diff]", {
          surface: "home",
          sqlIds,
          redisIds,
        });
      }
    }
    console.log("[feed.path=shadow]", { surface: "home" });
    return sqlResult;
  }
  console.log("[feed.path=redis]", { surface: "home" });
  return redisResult ?? loadHomeFeed(params);
}

export async function loadHomeFeedFromTimeline(params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<HomeFeedResult> {
  const limit = Math.min(params.limit ?? 20, 50);
  const parsed = parseHomeFeedCursor(params.cursor);
  const client = await readPool.connect();

  try {
    if (parsed.phase === "discovery") {
      const rows = await loadDiscoveryHomeRows(client, {
        userId: params.userId,
        createdAt: parsed.createdAt || null,
        postId: parsed.postId,
        limit,
      });
      const posts = await hydrateHomeRows(client, params.userId, rows, true);
      const last = posts[posts.length - 1];
      return {
        posts,
        nextCursor:
          posts.length === limit && last
            ? encodeHomeFeedCursor("discovery", last.createdAt, last.id)
            : null,
      };
    }

    const { rows: circleRows } = await client.query(
      `SELECT c.id, c.circle_type, c.display_name, c.key, c.metadata
       FROM circle_members cm
       JOIN circles c ON c.id = cm.circle_id
       WHERE cm.user_id = $1`,
      [params.userId]
    );

    const cursor =
      parsed.createdAt
        ? { createdAt: parsed.createdAt, postId: parsed.postId }
        : null;

    for (const row of circleRows) {
      if (!(await getCircleTimelineMeta(String(row.id)))) {
        await backfillCircle(String(row.id));
      }
    }

    const byCircle = await listManyCircleTimelinesFromCursor({
      circleIds: circleRows.map((row) => String(row.id)),
      maxScore: cursor ? createdAtToScoreMs(cursor.createdAt) : "+inf",
      limitPerCircle: Math.min(80, limit * 4),
    });

    type Candidate = TimelineEntry & {
      circleId: string;
      circleType: string;
      circleName: string;
      circleKey: string;
      circleMetadata: Record<string, unknown>;
    };
    const merged = new Map<string, Candidate>();
    for (const circle of circleRows) {
      const circleId = String(circle.id);
      const entries = afterExclusiveCursor(byCircle.get(circleId) ?? [], cursor);
      for (const entry of entries) {
        const current = merged.get(entry.postId);
        const next: Candidate = {
          ...entry,
          circleId,
          circleType: circle.circle_type,
          circleName: circle.display_name,
          circleKey: circle.key,
          circleMetadata: (circle.metadata ?? {}) as Record<string, unknown>,
        };
        if (!current || circleRank(next.circleType) < circleRank(current.circleType)) {
          merged.set(entry.postId, next);
        }
      }
    }

    const ranked = [...merged.values()].sort((a, b) => {
      if (b.scoreMs !== a.scoreMs) return b.scoreMs - a.scoreMs;
      return a.postId < b.postId ? 1 : -1;
    });

    const previewIds = ranked.map((item) => item.postId);
    const loadPreview = async (
      db: typeof client,
      ids: string[]
    ): Promise<Array<Record<string, unknown>>> => {
      if (ids.length === 0) return [];
      const { rows } = await db.query(
        `SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.edited_at, p.author_id,
                u.anonymous_handle, u.avatar_key
         FROM circle_posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.id = ANY($1::uuid[])`,
        [ids]
      );
      return rows as Array<Record<string, unknown>>;
    };
    let previewRows = await loadPreview(client, previewIds);
    const found = new Set(previewRows.map((row) => String(row.id)));
    const missing = previewIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      const primary = await pool.connect();
      try {
        const retried = await loadPreview(primary, missing);
        previewRows = [...previewRows, ...retried];
      } finally {
        primary.release();
      }
    }

    const byId = new Map(previewRows.map((row) => [String(row.id), row]));
    const pinChecked = await authorsSharingPin(
      client,
      params.userId,
      previewRows.map((row) => String(row.author_id))
    );

    const primaryCandidates = ranked.filter((item) => {
      const post = byId.get(item.postId);
      if (!post) return false;
      if (item.circleType !== "curriculum") return true;
      return pinChecked.has(String(post.author_id));
    });

    const chosen = primaryCandidates.slice(0, limit);
    const homeRows = chosen
      .map((item) => {
        const post = byId.get(item.postId);
        if (!post) return null;
        return {
          id: post.id,
          body: post.body,
          tag: post.tag,
          reply_count: post.reply_count,
          created_at: post.created_at,
          edited_at: post.edited_at,
          author_id: post.author_id,
          anonymous_handle: post.anonymous_handle,
          avatar_key: post.avatar_key,
          circle_id: item.circleId,
          circle_name: item.circleName,
          circle_type: item.circleType,
          circle_key: item.circleKey,
          circle_metadata: item.circleMetadata,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    let primaryPosts = await hydrateHomeRows(
      client,
      params.userId,
      homeRows,
      false
    );

    if (primaryPosts.length < limit) {
      console.log("[timeline.fallback.sql]", { reason: "home_primary_tail" });
      const tailCursor =
        primaryPosts.length > 0
          ? {
              createdAt: primaryPosts[primaryPosts.length - 1].createdAt,
              postId: primaryPosts[primaryPosts.length - 1].id,
            }
          : cursor;
      const sqlRows = await loadMemberHomeRows(client, {
        userId: params.userId,
        createdAt: tailCursor?.createdAt ?? null,
        postId: tailCursor?.postId,
        limit: limit - primaryPosts.length,
      });
      const known = new Set(primaryPosts.map((post) => post.id));
      const extra = await hydrateHomeRows(
        client,
        params.userId,
        sqlRows.filter((row) => !known.has(String(row.id))),
        false
      );
      primaryPosts = [...primaryPosts, ...extra].slice(0, limit);
    }

    if (primaryPosts.length === limit) {
      const last = primaryPosts[primaryPosts.length - 1];
      return {
        posts: primaryPosts,
        nextCursor: encodeHomeFeedCursor("primary", last.createdAt, last.id),
      };
    }

    const discoveryLimit = limit - primaryPosts.length;
    if (discoveryLimit <= 0) {
      return { posts: primaryPosts, nextCursor: null };
    }

    const discoveryRows = await loadDiscoveryHomeRows(client, {
      userId: params.userId,
      createdAt: null,
      postId: undefined,
      limit: discoveryLimit,
    });
    const discoveryPosts = await hydrateHomeRows(
      client,
      params.userId,
      discoveryRows,
      true
    );
    const seen = new Set(primaryPosts.map((post) => post.id));
    const posts = [
      ...primaryPosts,
      ...discoveryPosts.filter((post) => !seen.has(post.id)),
    ];
    const last = discoveryPosts[discoveryPosts.length - 1];
    return {
      posts,
      nextCursor:
        discoveryPosts.length === discoveryLimit && last
          ? encodeHomeFeedCursor("discovery", last.createdAt, last.id)
          : null,
    };
  } finally {
    client.release();
  }
}

export async function rebuildCircleTimeline(circleId?: string) {
  const client = await pool.connect();
  try {
    const ids = circleId
      ? [circleId]
      : (
          await client.query(`SELECT id FROM circles`)
        ).rows.map((row) => String(row.id));
    let rebuilt = 0;
    for (const id of ids) {
      const locked = await acquireCircleTimelineLock(id);
      if (!locked) continue;
      try {
        const rows = await loadLatestCircleTimelineRows(client, id);
        if (await backfillCircleTimeline(id, rows)) rebuilt += 1;
      } finally {
        await releaseCircleTimelineLock(id);
      }
    }
    return { rebuilt, total: ids.length };
  } finally {
    client.release();
  }
}
