import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { buildReviewAuthorView } from "../lib/author.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { createNotification } from "../services/notifications.js";

async function recomputeProviderRating(
  client: PoolClient,
  providerId: string
) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 2) AS avg
     FROM provider_reviews
     WHERE provider_id = $1 AND hidden = false`,
    [providerId]
  );
  await client.query(
    `UPDATE providers
     SET rating_count = $2, rating_avg = $3, updated_at = now()
     WHERE user_id = $1`,
    [providerId, rows[0].count, rows[0].avg]
  );
}

async function hasEngagement(
  client: PoolClient,
  userId: string,
  providerId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM reminders r
     JOIN activities a ON a.id = r.activity_id
     WHERE r.user_id = $1 AND a.provider_id = $2
     LIMIT 1`,
    [userId, providerId]
  );
  return rows.length > 0;
}

export function createProviderReviewRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/:providerId/reviews", async (c) => {
    const providerId = c.req.param("providerId");
    const client = await pool.connect();
    try {
      const provider = await client.query(
        `SELECT user_id, org_name, verified, rating_avg, rating_count, fee_min, fee_max
         FROM providers WHERE user_id = $1`,
        [providerId]
      );
      if (provider.rows.length === 0) {
        return c.json({ error: "Provider not found" }, 404);
      }

      const { rows } = await client.query(
        `SELECT pr.id, pr.rating, pr.body, pr.engagement_verified, pr.created_at,
                pr.author_id, u.anonymous_handle
         FROM provider_reviews pr
         JOIN users u ON u.id = pr.author_id
         WHERE pr.provider_id = $1 AND pr.hidden = false
         ORDER BY pr.created_at DESC
         LIMIT 50`,
        [providerId]
      );

      const reviews = await Promise.all(
        rows.map(async (row) => {
          const author = await buildReviewAuthorView(
            client,
            row.author_id,
            row.anonymous_handle
          );
          const reply = await client.query(
            `SELECT body, created_at FROM provider_review_replies
             WHERE review_id = $1`,
            [row.id]
          );
          return {
            id: row.id,
            rating: row.rating,
            body: row.body,
            engagementVerified: row.engagement_verified,
            createdAt: row.created_at,
            author,
            reply: reply.rows[0]
              ? {
                  body: reply.rows[0].body,
                  createdAt: reply.rows[0].created_at,
                }
              : null,
          };
        })
      );

      const p = provider.rows[0];
      return c.json({
        provider: {
          id: p.user_id,
          orgName: p.org_name,
          verified: p.verified,
          ratingAvg:
            p.rating_count >= 3 && p.rating_avg != null
              ? Number(p.rating_avg)
              : null,
          ratingCount: p.rating_count,
          feeMin: p.fee_min != null ? Number(p.fee_min) : null,
          feeMax: p.fee_max != null ? Number(p.fee_max) : null,
        },
        reviews,
      });
    } finally {
      client.release();
    }
  });

  app.post("/:providerId/reviews", async (c) => {
    const userId = c.get("user").sub;
    const providerId = c.req.param("providerId");
    const body = await c.req.json<{ rating?: number; reviewBody?: string }>();

    const rating = body.rating;
    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: "Rating must be between 1 and 5" }, 400);
    }

    const client = await pool.connect();
    try {
      const provider = await client.query(
        "SELECT user_id FROM providers WHERE user_id = $1",
        [providerId]
      );
      if (provider.rows.length === 0) {
        return c.json({ error: "Provider not found" }, 404);
      }
      if (providerId === userId) {
        return c.json({ error: "You cannot review yourself" }, 400);
      }

      await client.query("BEGIN");
      const engagementVerified = await hasEngagement(
        client,
        userId,
        providerId
      );

      await client.query(
        `INSERT INTO provider_reviews (provider_id, author_id, rating, body, engagement_verified)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (provider_id, author_id) DO UPDATE SET
           rating = EXCLUDED.rating,
           body = EXCLUDED.body,
           engagement_verified = EXCLUDED.engagement_verified,
           updated_at = now()`,
        [
          providerId,
          userId,
          rating,
          body.reviewBody?.trim() || null,
          engagementVerified,
        ]
      );

      await recomputeProviderRating(client, providerId);

      const providerUser = await client.query(
        "SELECT push_token, notification_prefs FROM users WHERE id = $1",
        [providerId]
      );
      if (providerUser.rows.length > 0) {
        await createNotification(client, {
          userId: providerId,
          type: "provider_update",
          title: "New review received",
          body: `A parent left a ${rating}-star review`,
          data: { providerId },
          pushToken: providerUser.rows[0].push_token,
          notificationPrefs: providerUser.rows[0].notification_prefs,
        });
      }

      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.delete("/:providerId/reviews/mine", async (c) => {
    const userId = c.get("user").sub;
    const providerId = c.req.param("providerId");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM provider_reviews
         WHERE provider_id = $1 AND author_id = $2`,
        [providerId, userId]
      );
      await recomputeProviderRating(client, providerId);
      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  return app;
}

export function createProviderReviewReplyRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.post("/:reviewId/reply", async (c) => {
    const userId = c.get("user").sub;
    const reviewId = c.req.param("reviewId");
    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();
    if (!text) {
      return c.json({ error: "body is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const review = await client.query(
        `SELECT pr.id, pr.provider_id, pr.author_id
         FROM provider_reviews pr
         WHERE pr.id = $1`,
        [reviewId]
      );
      if (review.rows.length === 0) {
        return c.json({ error: "Review not found" }, 404);
      }
      if (review.rows[0].provider_id !== userId) {
        return c.json({ error: "Only the provider can reply" }, 403);
      }

      await client.query(
        `INSERT INTO provider_review_replies (review_id, provider_id, body)
         VALUES ($1, $2, $3)
         ON CONFLICT (review_id) DO UPDATE SET body = EXCLUDED.body`,
        [reviewId, userId, text]
      );

      const author = await client.query(
        "SELECT push_token, notification_prefs FROM users WHERE id = $1",
        [review.rows[0].author_id]
      );
      if (author.rows.length > 0) {
        await createNotification(client, {
          userId: review.rows[0].author_id,
          type: "provider_update",
          title: "Provider replied to your review",
          body: text.slice(0, 80),
          data: { reviewId, providerId: userId },
          pushToken: author.rows[0].push_token,
          notificationPrefs: author.rows[0].notification_prefs,
        });
      }

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}
