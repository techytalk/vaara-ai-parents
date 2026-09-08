import type { PoolClient } from "pg";
import {
  attachTopicsToPost,
  resolveTopicSlugs,
} from "../lib/topics.js";
import { createPollForPost, type PollInput } from "../lib/polls.js";
import { type MediaType } from "../lib/media-storage.js";
import { dispatchPostCreated } from "../lib/async-events.js";
import type { CircleTarget } from "@vaara/redis";

export const MAX_GUEST_CIRCLES_PER_POST = 5;
/** Soft safety cap on member circles in one publish (not a product “5” limit). */
export const MAX_MEMBER_CIRCLES_PER_POST = 50;
export const MAX_GUEST_PLACEMENTS_PER_DAY = 5;

export type VerifiedMediaItem = {
  storageKey: string;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type CrossPostTargetResult = {
  circleId: string;
  postId: string;
  accessMode: "member" | "guest";
  displayName: string;
  isPrimary: boolean;
};

export type CircleDirectoryItem = {
  id: string;
  displayName: string;
  circleType: string;
  subtitle: string | null;
  accessMode: "member" | "guest";
  acceptsGuestPosts: boolean;
};

type CircleRow = {
  id: string;
  circle_type: string;
  key: string;
  display_name: string;
  metadata: Record<string, unknown>;
  accepts_guest_posts: boolean;
};

function subtitleFromCircle(row: CircleRow): string | null {
  const meta = row.metadata ?? {};
  const parts: string[] = [];
  if (typeof meta.school_name === "string" && meta.school_name.trim()) {
    parts.push(meta.school_name.trim());
  }
  if (typeof meta.city === "string" && meta.city.trim()) {
    parts.push(meta.city.trim());
  } else if (typeof meta.locality === "string" && meta.locality.trim()) {
    parts.push(meta.locality.trim());
  }
  if (typeof meta.curriculum_name === "string" && meta.curriculum_name.trim()) {
    parts.push(meta.curriculum_name.trim());
  } else if (typeof meta.code === "string" && meta.code.trim()) {
    parts.push(meta.code.trim());
  }
  if (typeof meta.grade_label === "string" && meta.grade_label.trim()) {
    parts.push(meta.grade_label.trim());
  }
  if (parts.length === 0) {
    return row.circle_type.replace(/_/g, " ");
  }
  return parts.join(" · ");
}

export async function getUserTimezone(
  client: PoolClient,
  userId: string
): Promise<string> {
  const { rows } = await client.query(
    `SELECT timezone FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.timezone || "Asia/Kolkata";
}

export async function countGuestPlacementsToday(
  client: PoolClient,
  userId: string,
  timezone: string
): Promise<number> {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM circle_post_targets pct
     JOIN circle_posts p ON p.id = pct.post_id
     WHERE p.author_id = $1
       AND pct.access_mode = 'guest'
       AND (p.created_at AT TIME ZONE $2)::date
           = (now() AT TIME ZONE $2)::date`,
    [userId, timezone]
  );
  return rows[0]?.count ?? 0;
}

export async function getGuestQuotaRemaining(
  client: PoolClient,
  userId: string
): Promise<{ used: number; remaining: number; limit: number; timezone: string }> {
  const timezone = await getUserTimezone(client, userId);
  const used = await countGuestPlacementsToday(client, userId, timezone);
  return {
    used,
    remaining: Math.max(0, MAX_GUEST_PLACEMENTS_PER_DAY - used),
    limit: MAX_GUEST_PLACEMENTS_PER_DAY,
    timezone,
  };
}

export async function searchCircleDirectory(
  client: PoolClient,
  userId: string,
  params: { q?: string; type?: string; limit?: number }
): Promise<{
  circles: CircleDirectoryItem[];
  guestQuota: {
    used: number;
    remaining: number;
    limit: number;
    timezone: string;
  };
}> {
  const limit = Math.min(Math.max(params.limit ?? 30, 1), 50);
  const q = params.q?.trim() ?? "";
  const type = params.type?.trim() || null;

  const sqlParams: unknown[] = [userId];
  let typeClause = "";
  if (type) {
    sqlParams.push(type);
    typeClause = `AND c.circle_type = $${sqlParams.length}`;
  } else {
    // Class-level school circles are too numerous for guest search; keep
    // school / curriculum / locality / grade / community instead.
    typeClause = `AND c.circle_type <> 'school_class'`;
  }

  let searchClause = "";
  if (q) {
    sqlParams.push(`%${q.toLowerCase()}%`);
    const p = `$${sqlParams.length}`;
    searchClause = `AND (
      lower(c.display_name) LIKE ${p}
      OR lower(coalesce(c.metadata->>'school_name', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'city', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'locality', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'curriculum_name', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'code', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'grade_label', '')) LIKE ${p}
      OR lower(coalesce(c.metadata->>'community_name', '')) LIKE ${p}
      OR lower(coalesce(c.key, '')) LIKE ${p}
    )`;
  }

  sqlParams.push(limit);
  const { rows } = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata,
            c.accepts_guest_posts,
            EXISTS (
              SELECT 1 FROM circle_members cm
              WHERE cm.circle_id = c.id AND cm.user_id = $1
            ) AS is_member
     FROM circles c
     WHERE c.accepts_guest_posts = true
       ${typeClause}
       ${searchClause}
       AND NOT EXISTS (
         SELECT 1 FROM circle_members cm
         WHERE cm.circle_id = c.id AND cm.user_id = $1
       )
     ORDER BY
       CASE c.circle_type
         WHEN 'school_class' THEN 1
         WHEN 'class' THEN 2
         WHEN 'school' THEN 3
         WHEN 'curriculum' THEN 4
         WHEN 'community' THEN 5
         WHEN 'locality' THEN 6
         ELSE 7
       END,
       c.display_name
     LIMIT $${sqlParams.length}`,
    sqlParams
  );

  const guestQuota = await getGuestQuotaRemaining(client, userId);

  return {
    circles: rows.map((row) => {
      const circleRow = row as CircleRow & { is_member: boolean };
      return {
        id: circleRow.id,
        displayName: circleRow.display_name,
        circleType: circleRow.circle_type,
        subtitle: subtitleFromCircle(circleRow),
        accessMode: "guest" as const,
        acceptsGuestPosts: Boolean(circleRow.accepts_guest_posts),
      };
    }),
    guestQuota,
  };
}

export type CreateCrossPostsResult =
  | {
      ok: true;
      groupId: string;
      postId: string;
      primaryCircleId: string;
      posts: CrossPostTargetResult[];
      guestQuota: {
        used: number;
        remaining: number;
        limit: number;
        timezone: string;
      };
      topicIds: string[];
      topicSlugs: string[];
      circleRows: Array<{
        id: string;
        circle_type: string;
        key: string;
        display_name: string;
        metadata: Record<string, unknown>;
      }>;
    }
  | { ok: false; error: string; status: 400 | 403 | 404 };

/**
 * One post, many circle placements, one shared reply thread.
 * Guest feed browsing stays closed; membership still gates normal circle access.
 */
export async function createCrossPosts(
  client: PoolClient,
  params: {
    userId: string;
    body: string;
    tag: string;
    targetCircleIds: string[];
    media: VerifiedMediaItem[];
    poll?: PollInput;
    topicSlugs?: string[];
  }
): Promise<CreateCrossPostsResult> {
  const targetCircleIds = [...new Set(params.targetCircleIds)];
  if (targetCircleIds.length === 0) {
    return { ok: false, error: "Select at least one circle", status: 400 };
  }
  if (targetCircleIds.length > MAX_MEMBER_CIRCLES_PER_POST + MAX_GUEST_CIRCLES_PER_POST) {
    return {
      ok: false,
      error: "Too many circles selected for one post",
      status: 400,
    };
  }

  let topicIds: string[] = [];
  let topicSlugs: string[] = [];
  if (params.topicSlugs && params.topicSlugs.length > 0) {
    const resolved = await resolveTopicSlugs(client, params.topicSlugs);
    if ("error" in resolved) {
      return { ok: false, error: resolved.error, status: 400 };
    }
    topicIds = resolved.topicIds;
    topicSlugs = resolved.topics
      .map((topic) => topic.slug)
      .filter((slug): slug is string => Boolean(slug));
  }

  const circleResult = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata,
            c.accepts_guest_posts,
            EXISTS (
              SELECT 1 FROM circle_members cm
              WHERE cm.circle_id = c.id AND cm.user_id = $1
            ) AS is_member
     FROM circles c
     WHERE c.id = ANY($2::uuid[])`,
    [params.userId, targetCircleIds]
  );

  if (circleResult.rows.length !== targetCircleIds.length) {
    return { ok: false, error: "One or more circles were not found", status: 404 };
  }

  const byId = new Map(
    circleResult.rows.map((row) => [row.id as string, row])
  );

  const classified: Array<{
    id: string;
    accessMode: "member" | "guest";
    displayName: string;
  }> = [];

  for (const id of targetCircleIds) {
    const row = byId.get(id)!;
    const isMember = Boolean(row.is_member);
    if (!isMember && !row.accepts_guest_posts) {
      return {
        ok: false,
        error: `${row.display_name} does not accept guest posts`,
        status: 403,
      };
    }
    classified.push({
      id,
      accessMode: isMember ? "member" : "guest",
      displayName: row.display_name,
    });
  }

  const guestCount = classified.filter((c) => c.accessMode === "guest").length;
  const memberCount = classified.length - guestCount;
  if (guestCount > MAX_GUEST_CIRCLES_PER_POST) {
    return {
      ok: false,
      error: `You can add up to ${MAX_GUEST_CIRCLES_PER_POST} circles you are not a member of`,
      status: 400,
    };
  }
  if (memberCount > MAX_MEMBER_CIRCLES_PER_POST) {
    return {
      ok: false,
      error: "Too many of your circles selected for one post",
      status: 400,
    };
  }
  const timezone = await getUserTimezone(client, params.userId);
  const usedToday = await countGuestPlacementsToday(
    client,
    params.userId,
    timezone
  );
  if (usedToday + guestCount > MAX_GUEST_PLACEMENTS_PER_DAY) {
    const remaining = Math.max(0, MAX_GUEST_PLACEMENTS_PER_DAY - usedToday);
    return {
      ok: false,
      error:
        remaining === 0
          ? "You have used all 5 guest circle posts for today. Try again tomorrow."
          : `Only ${remaining} guest circle post${remaining === 1 ? "" : "s"} remaining today.`,
      status: 400,
    };
  }

  // Prefer a member circle as primary/origin when mixed; else first selected.
  const primary =
    classified.find((c) => c.accessMode === "member") ?? classified[0];
  const postingContext = guestCount > 0 ? "guest" : "member";

  const group = await client.query(
    `INSERT INTO cross_post_groups (author_id) VALUES ($1) RETURNING id`,
    [params.userId]
  );
  const groupId = group.rows[0].id as string;

  const { rows: postRows } = await client.query(
    `INSERT INTO circle_posts
       (circle_id, author_id, body, tag, posting_context, cross_post_group_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      primary.id,
      params.userId,
      params.body,
      params.tag,
      postingContext,
      groupId,
    ]
  );
  const postId = postRows[0].id as string;

  for (const target of classified) {
    await client.query(
      `INSERT INTO circle_post_targets (post_id, circle_id, is_primary, access_mode)
       VALUES ($1, $2, $3, $4)`,
      [postId, target.id, target.id === primary.id, target.accessMode]
    );
  }

  for (const [index, item] of params.media.entries()) {
    await client.query(
      `INSERT INTO circle_post_media
         (post_id, storage_key, media_type, mime_type, size_bytes,
          width, height, duration_ms, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        postId,
        item.storageKey,
        item.mediaType,
        item.mimeType,
        item.sizeBytes,
        item.width,
        item.height,
        item.durationMs,
        index,
      ]
    );
  }

  if (params.poll) {
    await createPollForPost(client, postId, params.poll);
  }

  if (topicIds.length > 0) {
    await attachTopicsToPost(client, postId, topicIds);
  }

  const posts: CrossPostTargetResult[] = classified.map((target) => ({
    circleId: target.id,
    postId,
    accessMode: target.accessMode,
    displayName: target.displayName,
    isPrimary: target.id === primary.id,
  }));

  const guestQuota = {
    used: usedToday + guestCount,
    remaining: Math.max(
      0,
      MAX_GUEST_PLACEMENTS_PER_DAY - (usedToday + guestCount)
    ),
    limit: MAX_GUEST_PLACEMENTS_PER_DAY,
    timezone,
  };

  return {
    ok: true,
    groupId,
    postId,
    primaryCircleId: primary.id,
    posts,
    guestQuota,
    topicIds,
    topicSlugs,
    circleRows: circleResult.rows.map((row) => ({
      id: row.id as string,
      circle_type: row.circle_type as string,
      key: row.key as string,
      display_name: row.display_name as string,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    })),
  };
}

/** After commit: one notification/realtime fanout for the shared post. */
export async function dispatchCrossPostsCreated(params: {
  userId: string;
  body: string;
  pollQuestion?: string;
  postId: string;
  classifiedTargets: CircleTarget[];
  topicIds: string[];
  topicSlugs: string[];
}) {
  const preview =
    params.body ||
    (params.pollQuestion?.trim()
      ? params.pollQuestion.trim()
      : "Shared a photo or video");

  await dispatchPostCreated({
    postId: params.postId,
    authorId: params.userId,
    postPreview: preview,
    targets: params.classifiedTargets,
    topicIds: params.topicIds,
    topicPreview: params.body || "New post in a topic you follow",
    topicSlugs: params.topicSlugs,
    circleIds: params.classifiedTargets.map((t) => t.id),
  });
}

export function toCircleTargets(
  rows: Array<{
    id: string;
    circle_type: string;
    display_name: string;
  }>
): CircleTarget[] {
  return rows.map((row) => ({
    id: row.id,
    circle_type: row.circle_type,
    display_name: row.display_name,
  }));
}
