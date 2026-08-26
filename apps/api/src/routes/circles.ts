import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import {
  assertCircleMember,
  assertSharedCircle,
  buildAuthorView,
  isBlocked,
} from "../lib/author.js";
import {
  attachTopicsToPost,
  loadTopicsForPosts,
  notifyTopicFollowers,
  resolveTopicSlugs,
  type TopicSummary,
} from "../lib/topics.js";
import {
  buildPeerView,
  getDisclosureState,
  offerDisclosure,
  type DisclosureLevel,
} from "../services/disclosure.js";
import {
  notifyCirclePostMulti,
  notifyCircleReply,
  notifyDirectMessage,
} from "../services/notifications.js";
import {
  castPollVote,
  createPollForPost,
  getPollForPost,
  loadPostPolls,
  validatePollInput,
  type PollView,
} from "../lib/polls.js";
import { syncCircleMembership } from "../services/circle-sync.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  MAX_POST_MEDIA,
  mediaPublicUrl,
  type MediaType,
  verifyUploadedMedia,
} from "../lib/media-storage.js";

const POST_TAGS = ["question", "recommendation", "heads_up", "general"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_POST_CIRCLES = 5;

type PostMediaView = {
  id: string;
  type: MediaType;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

function mapPost(
  row: Record<string, unknown>,
  author: { anonymousHandle: string; contextLabel: string; userId: string },
  media: PostMediaView[] = [],
  poll?: PollView | null,
  topics: TopicSummary[] = []
) {
  return {
    id: row.id,
    body: row.body,
    tag: row.tag,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    media,
    poll: poll ?? null,
    topics,
    author: {
      userId: author.userId,
      anonymousHandle: author.anonymousHandle,
      contextLabel: author.contextLabel,
    },
  };
}

async function loadPostMedia(
  client: PoolClient,
  postIds: string[]
): Promise<Map<string, PostMediaView[]>> {
  const result = new Map<string, PostMediaView[]>();
  if (postIds.length === 0) return result;

  const { rows } = await client.query(
    `SELECT id, post_id, storage_key, media_type, mime_type,
            width, height, duration_ms
     FROM circle_post_media
     WHERE post_id = ANY($1::uuid[])
     ORDER BY post_id, sort_order`,
    [postIds]
  );

  for (const row of rows) {
    const media = result.get(row.post_id) ?? [];
    media.push({
      id: row.id,
      type: row.media_type,
      url: mediaPublicUrl(row.storage_key),
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      durationMs: row.duration_ms,
    });
    result.set(row.post_id, media);
  }
  return result;
}

export function createCirclesRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await syncCircleMembership(client, userId);
      const { rows } = await client.query(
        `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata,
                COUNT(cm_all.user_id)::int AS member_count
         FROM circle_members cm
         JOIN circles c ON c.id = cm.circle_id
         JOIN circle_members cm_all ON cm_all.circle_id = c.id
         WHERE cm.user_id = $1
         GROUP BY c.id
         ORDER BY
           CASE c.circle_type
             WHEN 'curriculum' THEN 1
             WHEN 'locality' THEN 2
             WHEN 'school_class' THEN 3
             WHEN 'class' THEN 4
             WHEN 'school' THEN 5
             WHEN 'community' THEN 6
           END,
           c.display_name`,
        [userId]
      );
      await client.query("COMMIT");

      return c.json(
        rows.map((row) => ({
          id: row.id,
          circleType: row.circle_type,
          key: row.key,
          displayName: row.display_name,
          metadata: row.metadata,
          memberCount: row.member_count,
        }))
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });

  app.get("/:circleId/members", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const { rows } = await client.query(
        `SELECT u.id, u.anonymous_handle
         FROM circle_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.circle_id = $1 AND u.id != $2
         ORDER BY u.anonymous_handle`,
        [circleId, userId]
      );

      const members = await Promise.all(
        rows.map(async (row) => {
          const author = await buildAuthorView(
            client,
            row.id,
            row.anonymous_handle,
            circle
          );
          return {
            userId: author.userId,
            anonymousHandle: author.anonymousHandle,
            contextLabel: author.contextLabel,
          };
        })
      );

      return c.json(members);
    } finally {
      client.release();
    }
  });

  app.get("/:circleId/feed", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const cursor = c.req.query("cursor");
    const scope = c.req.query("scope") ?? "local";
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);

    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const localFilter =
        circle.circle_type === "curriculum" && scope === "local";

      let query = `
        SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.author_id,
               u.anonymous_handle
        FROM circle_posts p
        JOIN circle_post_targets pct ON pct.post_id = p.id
        JOIN users u ON u.id = p.author_id
        WHERE pct.circle_id = $1`;

      const params: unknown[] = [circleId];
      let paramIdx = 2;

      if (localFilter) {
        query += `
          AND EXISTS (
            SELECT 1 FROM user_locations viewer_loc
            JOIN user_locations author_loc ON author_loc.pin_code = viewer_loc.pin_code
            WHERE viewer_loc.user_id = $${paramIdx}
              AND author_loc.user_id = p.author_id
          )`;
        params.push(userId);
        paramIdx++;
      }

      if (cursor) {
        query += ` AND p.created_at < $${paramIdx}::timestamptz`;
        params.push(cursor);
        paramIdx++;
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${paramIdx}`;
      params.push(limit);

      const { rows } = await client.query(query, params);
      const mediaByPost = await loadPostMedia(
        client,
        rows.map((row) => row.id)
      );
      const memberCountResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [circleId]
      );
      const memberCount = memberCountResult.rows[0]?.count ?? 0;
      const pollsByPost = await loadPostPolls(
        client,
        rows.map((row) => row.id),
        userId,
        memberCount
      );
      const topicsByPost = await loadTopicsForPosts(
        client,
        rows.map((row) => row.id)
      );

      const posts = await Promise.all(
        rows.map(async (row) => {
          const author = await buildAuthorView(
            client,
            row.author_id,
            row.anonymous_handle,
            circle
          );
          return mapPost(
            row,
            author,
            mediaByPost.get(row.id) ?? [],
            pollsByPost.get(row.id),
            topicsByPost.get(row.id) ?? []
          );
        })
      );

      const nextCursor =
        rows.length === limit ? rows[rows.length - 1].created_at : null;

      return c.json({ posts, nextCursor });
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/posts", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const body = await c.req.json<{
      body?: string;
      tag?: string;
      targetCircleIds?: string[];
      poll?: {
        question?: string;
        options?: string[];
        hideResultsUntilVote?: boolean;
        closesAt?: string;
      };
      media?: Array<{
        storageKey?: string;
        mediaType?: MediaType;
        mimeType?: string;
        width?: number;
        height?: number;
        durationMs?: number;
      }>;
      topicSlugs?: string[];
    }>();

    const text = body.body?.trim() ?? "";
    if (!text && (!Array.isArray(body.media) || body.media.length === 0) && !body.poll) {
      return c.json({ error: "A message, poll, or attachment is required" }, 400);
    }

    if (body.poll) {
      const pollError = validatePollInput({
        question: body.poll.question ?? "",
        options: body.poll.options ?? [],
        hideResultsUntilVote: body.poll.hideResultsUntilVote,
        closesAt: body.poll.closesAt,
      });
      if (pollError) {
        return c.json({ error: pollError }, 400);
      }
    }

    const tag = body.tag ?? "general";
    if (!POST_TAGS.includes(tag as typeof POST_TAGS[number])) {
      return c.json({ error: "Invalid tag" }, 400);
    }

    const requestedTargets = Array.isArray(body.targetCircleIds)
      ? body.targetCircleIds
      : [];
    if (requestedTargets.some((id) => !UUID_PATTERN.test(id))) {
      return c.json({ error: "Invalid target circle" }, 400);
    }

    const targetCircleIds = [...new Set([circleId, ...requestedTargets])];
    if (targetCircleIds.length > MAX_POST_CIRCLES) {
      return c.json(
        { error: `A post can be shared with up to ${MAX_POST_CIRCLES} circles` },
        400
      );
    }

    const requestedMedia = Array.isArray(body.media) ? body.media : [];
    if (requestedMedia.length > MAX_POST_MEDIA) {
      return c.json(
        { error: `A post can include up to ${MAX_POST_MEDIA} attachments` },
        400
      );
    }

    for (const item of requestedMedia) {
      if (
        !item.storageKey ||
        (item.mediaType !== "image" && item.mediaType !== "video") ||
        !item.mimeType
      ) {
        return c.json({ error: "Invalid media attachment" }, 400);
      }
    }

    let verifiedMedia: Array<{
      storageKey: string;
      mediaType: MediaType;
      mimeType: string;
      sizeBytes: number;
      width: number | null;
      height: number | null;
      durationMs: number | null;
    }>;
    try {
      verifiedMedia = await Promise.all(
        requestedMedia.map(async (item) => {
          const storageKey = item.storageKey as string;
          const mediaType = item.mediaType as MediaType;
          const mimeType = item.mimeType as string;
          const verified = await verifyUploadedMedia({
            userId,
            storageKey,
            mediaType,
            mimeType,
          });
          return {
            storageKey,
            mediaType,
            mimeType: verified.mimeType,
            sizeBytes: verified.sizeBytes,
            width:
              Number.isInteger(item.width) && Number(item.width) > 0
                ? Number(item.width)
                : null,
            height:
              Number.isInteger(item.height) && Number(item.height) > 0
                ? Number(item.height)
                : null,
            durationMs:
              Number.isInteger(item.durationMs) && Number(item.durationMs) >= 0
                ? Number(item.durationMs)
                : null,
          };
        })
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "MEDIA_STORAGE_NOT_CONFIGURED"
      ) {
        return c.json({ error: "Media uploads are not configured" }, 503);
      }
      return c.json({ error: "An uploaded attachment is invalid" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const targetResult = await client.query(
        `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata
         FROM circles c
         JOIN circle_members cm ON cm.circle_id = c.id
         WHERE cm.user_id = $1 AND c.id = ANY($2::uuid[])`,
        [userId, targetCircleIds]
      );

      if (targetResult.rows.length !== targetCircleIds.length) {
        await client.query("ROLLBACK");
        return c.json(
          { error: "You can only post to circles you belong to" },
          403
        );
      }

      const primaryCircle = targetResult.rows.find((row) => row.id === circleId);
      if (!primaryCircle) {
        await client.query("ROLLBACK");
        return c.json({ error: "Primary circle not found" }, 404);
      }

      const { rows } = await client.query(
        `INSERT INTO circle_posts (circle_id, author_id, body, tag)
         VALUES ($1, $2, $3, $4)
         RETURNING id, body, tag, reply_count, created_at, author_id`,
        [circleId, userId, text, tag]
      );

      await client.query(
        `INSERT INTO circle_post_targets (post_id, circle_id, is_primary)
         SELECT $1, target_id, target_id = $2
         FROM unnest($3::uuid[]) AS target_id`,
        [rows[0].id, circleId, targetCircleIds]
      );

      const mediaViews: PostMediaView[] = [];
      for (const [index, item] of verifiedMedia.entries()) {
        const mediaResult = await client.query(
          `INSERT INTO circle_post_media
             (post_id, storage_key, media_type, mime_type, size_bytes,
              width, height, duration_ms, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            rows[0].id,
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
        mediaViews.push({
          id: mediaResult.rows[0].id,
          type: item.mediaType,
          url: mediaPublicUrl(item.storageKey),
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          durationMs: item.durationMs,
        });
      }

      if (body.poll) {
        await createPollForPost(client, rows[0].id, {
          question: body.poll.question ?? "",
          options: body.poll.options ?? [],
          hideResultsUntilVote: body.poll.hideResultsUntilVote,
          closesAt: body.poll.closesAt,
        });
      }

      let attachedTopics: TopicSummary[] = [];
      if (Array.isArray(body.topicSlugs) && body.topicSlugs.length > 0) {
        const resolved = await resolveTopicSlugs(client, body.topicSlugs);
        if ("error" in resolved) {
          await client.query("ROLLBACK");
          return c.json({ error: resolved.error }, 400);
        }
        await attachTopicsToPost(client, rows[0].id, resolved.topicIds);
        attachedTopics = resolved.topics;
      }

      const userRow = await client.query(
        "SELECT anonymous_handle FROM users WHERE id = $1",
        [userId]
      );
      const author = await buildAuthorView(
        client,
        userId,
        userRow.rows[0].anonymous_handle,
        primaryCircle
      );

      const memberCountResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [circleId]
      );
      const memberCount = memberCountResult.rows[0]?.count ?? 0;
      const pollsByPost = await loadPostPolls(
        client,
        [rows[0].id],
        userId,
        memberCount
      );

      await notifyCirclePostMulti(client, {
        targets: targetResult.rows,
        postId: rows[0].id,
        authorId: userId,
        postPreview:
          text ||
          (body.poll ? body.poll.question?.trim() || "Shared a poll" : "Shared a photo or video"),
      });

      if (attachedTopics.length > 0) {
        const topicIds = (
          await client.query(
            `SELECT topic_id FROM post_topics WHERE post_id = $1`,
            [rows[0].id]
          )
        ).rows.map((r) => r.topic_id);
        await notifyTopicFollowers(client, {
          postId: rows[0].id,
          authorId: userId,
          topicIds,
          preview: text || "New post in a topic you follow",
        });
      }

      await client.query("COMMIT");
      return c.json(
        mapPost(rows[0], author, mediaViews, pollsByPost.get(rows[0].id), attachedTopics),
        201
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/:circleId/posts/:postId", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const postId = c.req.param("postId");

    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const postResult = await client.query(
        `SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.author_id,
                u.anonymous_handle
         FROM circle_posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.id = $1
           AND EXISTS (
             SELECT 1 FROM circle_post_targets pct
             WHERE pct.post_id = p.id AND pct.circle_id = $2
           )`,
        [postId, circleId]
      );

      if (postResult.rows.length === 0) {
        return c.json({ error: "Post not found" }, 404);
      }

      const postRow = postResult.rows[0];
      const mediaByPost = await loadPostMedia(client, [postId]);
      const memberCountResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [circleId]
      );
      const memberCount = memberCountResult.rows[0]?.count ?? 0;
      const pollsByPost = await loadPostPolls(
        client,
        [postId],
        userId,
        memberCount
      );
      const postAuthor = await buildAuthorView(
        client,
        postRow.author_id,
        postRow.anonymous_handle,
        circle
      );

      const repliesResult = await client.query(
        `SELECT r.id, r.body, r.created_at, r.author_id, u.anonymous_handle
         FROM circle_post_replies r
         JOIN users u ON u.id = r.author_id
         WHERE r.post_id = $1
         ORDER BY r.created_at ASC`,
        [postId]
      );

      const replies = await Promise.all(
        repliesResult.rows.map(async (row) => {
          const author = await buildAuthorView(
            client,
            row.author_id,
            row.anonymous_handle,
            circle
          );
          return {
            id: row.id,
            body: row.body,
            createdAt: row.created_at,
            author: {
              userId: author.userId,
              anonymousHandle: author.anonymousHandle,
              contextLabel: author.contextLabel,
            },
          };
        })
      );

      return c.json({
        post: mapPost(
          postRow,
          postAuthor,
          mediaByPost.get(postId) ?? [],
          pollsByPost.get(postId)
        ),
        replies,
      });
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/posts/:postId/replies", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const postId = c.req.param("postId");
    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();

    if (!text) {
      return c.json({ error: "body is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const postCheck = await client.query(
        `SELECT p.id, p.author_id
         FROM circle_posts p
         WHERE p.id = $1
           AND EXISTS (
             SELECT 1 FROM circle_post_targets pct
             WHERE pct.post_id = p.id AND pct.circle_id = $2
           )`,
        [postId, circleId]
      );
      if (postCheck.rows.length === 0) {
        return c.json({ error: "Post not found" }, 404);
      }

      const { rows } = await client.query(
        `INSERT INTO circle_post_replies (post_id, author_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, body, created_at, author_id`,
        [postId, userId, text]
      );

      await client.query(
        `UPDATE circle_posts SET reply_count = reply_count + 1, updated_at = now()
         WHERE id = $1`,
        [postId]
      );

      const userRow = await client.query(
        "SELECT anonymous_handle FROM users WHERE id = $1",
        [userId]
      );
      const author = await buildAuthorView(
        client,
        userId,
        userRow.rows[0].anonymous_handle,
        circle
      );

      await notifyCircleReply(client, {
        postAuthorId: postCheck.rows[0].author_id,
        postId,
        circleId,
        circleName: circle.display_name ?? "your circle",
        replierId: userId,
        replyPreview: text,
      });

      return c.json(
        {
          id: rows[0].id,
          body: rows[0].body,
          createdAt: rows[0].created_at,
          author: {
            userId: author.userId,
            anonymousHandle: author.anonymousHandle,
            contextLabel: author.contextLabel,
          },
        },
        201
      );
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/posts/:postId/vote", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const postId = c.req.param("postId");
    const body = await c.req.json<{ optionId?: string }>();

    if (!body.optionId) {
      return c.json({ error: "optionId is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const postCheck = await client.query(
        `SELECT 1 FROM circle_post_targets
         WHERE post_id = $1 AND circle_id = $2`,
        [postId, circleId]
      );
      if (postCheck.rows.length === 0) {
        return c.json({ error: "Post not found" }, 404);
      }

      const poll = await getPollForPost(client, postId);
      if (!poll) {
        return c.json({ error: "This post has no poll" }, 404);
      }

      const voteError = await castPollVote(client, {
        pollId: poll.id,
        optionId: body.optionId,
        userId,
      });
      if (voteError) {
        return c.json({ error: voteError }, 400);
      }

      const memberCountResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [circleId]
      );
      const pollsByPost = await loadPostPolls(
        client,
        [postId],
        userId,
        memberCountResult.rows[0]?.count ?? 0
      );

      return c.json({ poll: pollsByPost.get(postId) ?? null });
    } finally {
      client.release();
    }
  });

  app.delete("/:circleId/posts/:postId/vote", async (c) => {
    const userId = c.get("user").sub;
    const circleId = c.req.param("circleId");
    const postId = c.req.param("postId");

    const client = await pool.connect();
    try {
      const circle = await assertCircleMember(client, circleId, userId);
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const poll = await getPollForPost(client, postId);
      if (!poll) {
        return c.json({ error: "This post has no poll" }, 404);
      }

      await client.query(
        `DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
        [poll.id, userId]
      );

      const memberCountResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [circleId]
      );
      const pollsByPost = await loadPostPolls(
        client,
        [postId],
        userId,
        memberCountResult.rows[0]?.count ?? 0
      );

      return c.json({ poll: pollsByPost.get(postId) ?? null });
    } finally {
      client.release();
    }
  });

  return app;
}

export function createConversationsRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT conv.id,
                conv.user_a_id,
                conv.user_b_id,
                conv.last_message_at,
                cp.last_read_at,
                peer.id AS peer_id,
                peer.anonymous_handle AS peer_handle,
                dm.body AS last_body,
                dm.created_at AS last_message_created
         FROM conversations conv
         JOIN conversation_participants cp
           ON cp.conversation_id = conv.id AND cp.user_id = $1
         JOIN users peer ON peer.id = CASE
           WHEN conv.user_a_id = $1 THEN conv.user_b_id
           ELSE conv.user_a_id
         END
         LEFT JOIN LATERAL (
           SELECT body, created_at FROM direct_messages
           WHERE conversation_id = conv.id
           ORDER BY created_at DESC LIMIT 1
         ) dm ON true
         WHERE cp.hidden = false
         ORDER BY conv.last_message_at DESC NULLS LAST, conv.created_at DESC`,
        [userId]
      );

      const conversations = await Promise.all(
        rows.map(async (row) => {
          const unread =
            row.last_message_created &&
            (!row.last_read_at ||
              new Date(row.last_message_created) > new Date(row.last_read_at));
          const peer = await buildPeerView(client, {
            conversationId: row.id,
            viewerId: userId,
          });
          return {
            id: row.id,
            peer: peer ?? {
              userId: row.peer_id,
              anonymousHandle: row.peer_handle,
              contextLabel: "",
              disclosureLevel: 0 as DisclosureLevel,
            },
            lastMessage: row.last_body
              ? { body: row.last_body, createdAt: row.last_message_created }
              : null,
            unread: Boolean(unread),
          };
        })
      );

      return c.json(conversations);
    } finally {
      client.release();
    }
  });

  app.post("/", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      peerUserId?: string;
      circleId?: string;
      postId?: string;
      listingId?: string;
    }>();

    const peerUserId = body.peerUserId;
    if (!peerUserId || peerUserId === userId) {
      return c.json({ error: "peerUserId is required" }, 400);
    }

    const client = await pool.connect();
    try {
      if (await isBlocked(client, userId, peerUserId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }

      const shared = await assertSharedCircle(client, userId, peerUserId);
      if (body.listingId) {
        const listing = await client.query(
          `SELECT id, seller_id, status FROM listings WHERE id = $1`,
          [body.listingId]
        );
        if (
          listing.rows.length === 0 ||
          listing.rows[0].seller_id !== peerUserId ||
          listing.rows[0].status !== "active"
        ) {
          return c.json({ error: "Invalid listing for this conversation" }, 400);
        }
      } else if (!shared) {
        return c.json({ error: "You must share a circle to message" }, 403);
      }

      const peerExists = await client.query(
        "SELECT id, anonymous_handle FROM users WHERE id = $1",
        [peerUserId]
      );
      if (peerExists.rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }

      const [userA, userB] =
        userId < peerUserId ? [userId, peerUserId] : [peerUserId, userId];

      let convId: string;
      const existing = await client.query(
        `SELECT id FROM conversations
         WHERE user_a_id = LEAST($1::uuid, $2::uuid)
           AND user_b_id = GREATEST($1::uuid, $2::uuid)`,
        [userId, peerUserId]
      );

      if (existing.rows.length > 0) {
        convId = existing.rows[0].id;
        await client.query(
          `UPDATE conversation_participants SET hidden = false
           WHERE conversation_id = $1 AND user_id = ANY($2::uuid[])`,
          [convId, [userId, peerUserId]]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO conversations (user_a_id, user_b_id, initiated_from_circle_id, initiated_from_post_id)
           VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), $3, $4)
           RETURNING id`,
          [userId, peerUserId, body.circleId ?? null, body.postId ?? null]
        );
        convId = inserted.rows[0].id;
        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id)
           VALUES ($1, $2), ($1, $3)
           ON CONFLICT DO NOTHING`,
          [convId, userId, peerUserId]
        );
      }

      return c.json({
        id: convId,
        peer: (await buildPeerView(client, {
          conversationId: convId,
          viewerId: userId,
        })) ?? {
          userId: peerUserId,
          anonymousHandle: peerExists.rows[0].anonymous_handle,
          contextLabel: "",
          disclosureLevel: 0,
        },
      });
    } finally {
      client.release();
    }
  });

  app.get("/:conversationId/messages", async (c) => {
    const userId = c.get("user").sub;
    const conversationId = c.req.param("conversationId");
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

    const client = await pool.connect();
    try {
      const memberCheck = await client.query(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      let query = `
        SELECT m.id, m.body, m.created_at, m.sender_id, u.anonymous_handle
        FROM direct_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1`;
      const params: unknown[] = [conversationId];

      if (cursor) {
        query += ` AND m.created_at > $2::timestamptz`;
        params.push(cursor);
      }

      query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows } = await client.query(query, params);

      const peer = await buildPeerView(client, {
        conversationId,
        viewerId: userId,
      });
      if (!peer) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      return c.json({
        peer,
        messages: rows.map((row) => ({
          id: row.id,
          body: row.body,
          createdAt: row.created_at,
          isMine: row.sender_id === userId,
          senderHandle: row.anonymous_handle,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/:conversationId/messages", async (c) => {
    const userId = c.get("user").sub;
    const conversationId = c.req.param("conversationId");
    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();

    if (!text) {
      return c.json({ error: "body is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const conv = await client.query(
        `SELECT c.id, c.user_a_id, c.user_b_id
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE c.id = $1 AND cp.user_id = $2`,
        [conversationId, userId]
      );
      if (conv.rows.length === 0) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      const peerId =
        conv.rows[0].user_a_id === userId
          ? conv.rows[0].user_b_id
          : conv.rows[0].user_a_id;

      if (await isBlocked(client, userId, peerId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }

      const { rows } = await client.query(
        `INSERT INTO direct_messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, body, created_at`,
        [conversationId, userId, text]
      );

      await client.query(
        `UPDATE conversations SET last_message_at = $2 WHERE id = $1`,
        [conversationId, rows[0].created_at]
      );

      const handleRow = await client.query(
        "SELECT anonymous_handle FROM users WHERE id = $1",
        [userId]
      );

      await notifyDirectMessage(client, {
        recipientId: peerId,
        senderHandle: handleRow.rows[0].anonymous_handle,
        conversationId,
        messagePreview: text,
      });

      return c.json({
        id: rows[0].id,
        body: rows[0].body,
        createdAt: rows[0].created_at,
        isMine: true,
        senderHandle: handleRow.rows[0].anonymous_handle,
      });
    } finally {
      client.release();
    }
  });

  app.patch("/:conversationId/read", async (c) => {
    const userId = c.get("user").sub;
    const conversationId = c.req.param("conversationId");

    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE conversation_participants
         SET last_read_at = now()
         WHERE conversation_id = $1 AND user_id = $2
         RETURNING conversation_id`,
        [conversationId, userId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Conversation not found" }, 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/:conversationId/disclosure", async (c) => {
    const userId = c.get("user").sub;
    const conversationId = c.req.param("conversationId");
    const client = await pool.connect();
    try {
      const state = await getDisclosureState(client, conversationId, userId);
      if (!state) {
        return c.json({ error: "Conversation not found" }, 404);
      }
      const peer = await buildPeerView(client, {
        conversationId,
        viewerId: userId,
      });
      return c.json({
        effectiveLevel: state.effectiveLevel,
        ownOffer: state.ownOffer,
        peerOffer: state.peerOffer,
        peer,
      });
    } finally {
      client.release();
    }
  });

  app.post("/:conversationId/disclosure", async (c) => {
    const userId = c.get("user").sub;
    const conversationId = c.req.param("conversationId");
    const body = await c.req.json<{ level?: number; purpose?: string }>();

    const level = body.level;
    if (level == null || level < 0 || level > 3) {
      return c.json({ error: "Invalid disclosure level" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await offerDisclosure(client, {
        conversationId,
        userId,
        level: level as DisclosureLevel,
        purpose: body.purpose ?? "marketplace",
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, 400);
      }
      const peer = await buildPeerView(client, {
        conversationId,
        viewerId: userId,
      });
      await client.query("COMMIT");
      return c.json({ ...result, peer });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  return app;
}
