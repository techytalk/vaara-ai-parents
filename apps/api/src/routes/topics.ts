import { Hono } from "hono";
import { pool } from "@vaara/db";
import { buildAuthorViewForPost } from "../lib/author.js";
import { mediaPublicUrl, type MediaType } from "../lib/media-storage.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

async function loadPostMedia(client: import("pg").PoolClient, postIds: string[]) {
  const result = new Map<
    string,
    Array<{
      id: string;
      type: MediaType;
      url: string;
      mimeType: string;
      width: number | null;
      height: number | null;
      durationMs: number | null;
    }>
  >();
  if (postIds.length === 0) return result;

  const { rows } = await client.query(
    `SELECT id, post_id, storage_key, media_type, mime_type, width, height, duration_ms
     FROM circle_post_media
     WHERE post_id = ANY($1::uuid[])
     ORDER BY sort_order`,
    [postIds]
  );

  for (const row of rows) {
    const list = result.get(row.post_id) ?? [];
    list.push({
      id: row.id,
      type: row.media_type,
      url: mediaPublicUrl(row.storage_key),
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      durationMs: row.duration_ms,
    });
    result.set(row.post_id, list);
  }
  return result;
}

export function createTopicsRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT slug, name, description, category, sensitive, follower_count, post_count
         FROM topics
         WHERE active = true
         ORDER BY category NULLS LAST, name`
      );

      const grouped: Record<
        string,
        Array<{
          slug: string;
          name: string;
          description: string | null;
          sensitive: boolean;
          followerCount: number;
          postCount: number;
        }>
      > = {};
      for (const row of rows) {
        const category = row.category ?? "General";
        grouped[category] = grouped[category] ?? [];
        grouped[category].push({
          slug: row.slug,
          name: row.name,
          description: row.description,
          sensitive: row.sensitive,
          followerCount: row.follower_count,
          postCount: row.post_count,
        });
      }

      return c.json({ categories: grouped });
    } finally {
      client.release();
    }
  });

  app.get("/:slug/feed", async (c) => {
    const userId = c.get("user").sub;
    const slug = c.req.param("slug");
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);

    const client = await pool.connect();
    try {
      const topic = await client.query(
        `SELECT t.id FROM topics t
         LEFT JOIN topic_aliases ta ON ta.topic_id = t.id
         WHERE (t.slug = $1 OR ta.alias = $1) AND t.active = true
         LIMIT 1`,
        [slug]
      );
      if (topic.rows.length === 0) {
        return c.json({ error: "Topic not found" }, 404);
      }
      const topicId = topic.rows[0].id;

      let query = `
        SELECT DISTINCT p.id, p.body, p.tag, p.reply_count, p.created_at,
               p.author_id, u.anonymous_handle, u.avatar_key
        FROM circle_posts p
        JOIN post_topics pt ON pt.post_id = p.id
        JOIN circle_post_targets t ON t.post_id = p.id
        JOIN circle_members cm ON cm.circle_id = t.circle_id
        JOIN users u ON u.id = p.author_id
        WHERE pt.topic_id = $1
          AND cm.user_id = $2`;
      const params: unknown[] = [topicId, userId];

      if (cursor) {
        query += ` AND p.created_at < $3::timestamptz`;
        params.push(cursor);
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows } = await client.query(query, params);
      const postIds = rows.map((r) => r.id);
      const mediaByPost = await loadPostMedia(client, postIds);

      const posts = await Promise.all(
        rows.map(async (row) => {
          const author = await buildAuthorViewForPost(
            client,
            userId,
            row.author_id,
            row.id,
            row.anonymous_handle,
            row.avatar_key
          );
          return {
            id: row.id,
            body: row.body,
            tag: row.tag,
            replyCount: row.reply_count,
            createdAt: row.created_at,
            media: mediaByPost.get(row.id) ?? [],
            author,
          };
        })
      );

      const nextCursor =
        rows.length === limit ? rows[rows.length - 1].created_at : null;

      return c.json({ posts, nextCursor });
    } finally {
      client.release();
    }
  });

  app.post("/:slug/follow", async (c) => {
    const userId = c.get("user").sub;
    const slug = c.req.param("slug");
    const client = await pool.connect();
    try {
      const topic = await client.query(
        `SELECT t.id FROM topics t
         LEFT JOIN topic_aliases ta ON ta.topic_id = t.id
         WHERE (t.slug = $1 OR ta.alias = $1) AND t.active = true
         LIMIT 1`,
        [slug]
      );
      if (topic.rows.length === 0) {
        return c.json({ error: "Topic not found" }, 404);
      }

      const inserted = await client.query(
        `INSERT INTO topic_follows (user_id, topic_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING topic_id`,
        [userId, topic.rows[0].id]
      );
      if (inserted.rows.length > 0) {
        await client.query(
          `UPDATE topics SET follower_count = follower_count + 1 WHERE id = $1`,
          [topic.rows[0].id]
        );
      }

      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  app.delete("/:slug/follow", async (c) => {
    const userId = c.get("user").sub;
    const slug = c.req.param("slug");
    const client = await pool.connect();
    try {
      const topic = await client.query(
        `SELECT t.id FROM topics t
         LEFT JOIN topic_aliases ta ON ta.topic_id = t.id
         WHERE (t.slug = $1 OR ta.alias = $1) AND t.active = true
         LIMIT 1`,
        [slug]
      );
      if (topic.rows.length === 0) {
        return c.json({ error: "Topic not found" }, 404);
      }

      const deleted = await client.query(
        `DELETE FROM topic_follows
         WHERE user_id = $1 AND topic_id = $2
         RETURNING topic_id`,
        [userId, topic.rows[0].id]
      );
      if (deleted.rows.length > 0) {
        await client.query(
          `UPDATE topics SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = $1`,
          [topic.rows[0].id]
        );
      }

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/requests", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ proposedName?: string; rationale?: string }>();
    const proposedName = body.proposedName?.trim();
    if (!proposedName) {
      return c.json({ error: "proposedName is required" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO topic_requests (requester_id, proposed_name, rationale)
         VALUES ($1, $2, $3)`,
        [userId, proposedName, body.rationale?.trim() || null]
      );
      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  return app;
}
