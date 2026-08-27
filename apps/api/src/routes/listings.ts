import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { isBlocked } from "../lib/author.js";
import {
  mediaPublicUrl,
  verifyListingMedia,
} from "../lib/media-storage.js";
import { buildPeerView } from "../services/disclosure.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { createNotification } from "../services/notifications.js";
import { dispatchListingCreated } from "../lib/async-events.js";

const LISTING_KINDS = ["for_sale", "free", "wanted"] as const;
const LISTING_STATUSES = ["active", "reserved", "completed", "expired", "removed"] as const;
const LISTING_CATEGORIES = [
  "textbooks",
  "uniforms",
  "sports",
  "instruments",
  "toys",
  "furniture",
  "other",
] as const;

const MAX_ACTIVE_LISTINGS = 10;
const MAX_NEW_LISTINGS_PER_WEEK = 15;
const MAX_LISTING_MEDIA = 5;

type ListingRow = Record<string, unknown>;

async function loadListingMedia(client: PoolClient, listingId: string) {
  const { rows } = await client.query(
    `SELECT id, storage_key, mime_type, width, height, sort_order
     FROM listing_media
     WHERE listing_id = $1
     ORDER BY sort_order`,
    [listingId]
  );
  return rows.map((row) => ({
    id: row.id,
    url: mediaPublicUrl(row.storage_key),
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
  }));
}

function mapListing(row: ListingRow, media: ReturnType<typeof loadListingMedia> extends Promise<infer T> ? T : never) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    category: row.category,
    title: row.title,
    description: row.description,
    priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
    priceCurrency: row.price_currency,
    communityKey: row.community_key,
    pinCode: row.pin_code,
    schoolId: row.school_id,
    gradeId: row.grade_id,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media,
    isMine: row.is_mine === true,
  };
}

async function getOrCreateListingConversation(
  client: PoolClient,
  params: {
    listingId: string;
    sellerId: string;
    buyerId: string;
  }
): Promise<string> {
  const existing = await client.query(
    `SELECT conversation_id FROM listing_interests
     WHERE listing_id = $1 AND user_id = $2 AND conversation_id IS NOT NULL`,
    [params.listingId, params.buyerId]
  );
  if (existing.rows[0]?.conversation_id) {
    return existing.rows[0].conversation_id;
  }

  const [userA, userB] =
    params.buyerId < params.sellerId
      ? [params.buyerId, params.sellerId]
      : [params.sellerId, params.buyerId];

  let convId: string;
  const conv = await client.query(
    `SELECT id FROM conversations
     WHERE user_a_id = LEAST($1::uuid, $2::uuid)
       AND user_b_id = GREATEST($1::uuid, $2::uuid)`,
    [params.buyerId, params.sellerId]
  );

  if (conv.rows.length > 0) {
    convId = conv.rows[0].id;
    await client.query(
      `UPDATE conversation_participants SET hidden = false
       WHERE conversation_id = $1 AND user_id = ANY($2::uuid[])`,
      [convId, [params.buyerId, params.sellerId]]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO conversations (user_a_id, user_b_id)
       VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
       RETURNING id`,
      [params.buyerId, params.sellerId]
    );
    convId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT DO NOTHING`,
      [convId, params.buyerId, params.sellerId]
    );
  }

  await client.query(
    `INSERT INTO listing_interests (listing_id, user_id, conversation_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (listing_id, user_id) DO UPDATE SET
       conversation_id = EXCLUDED.conversation_id`,
    [params.listingId, params.buyerId, convId]
  );

  return convId;
}

export function createListingRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const userId = c.get("user").sub;
    const scope = c.req.query("scope") ?? "community";
    const category = c.req.query("category");
    const kind = c.req.query("kind");
    const search = c.req.query("q");

    const client = await pool.connect();
    try {
      const loc = await client.query(
        `SELECT pin_code, community_key FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (loc.rows.length === 0) {
        return c.json({ error: "Set your location first" }, 400);
      }
      const { pin_code: pinCode, community_key: communityKey } = loc.rows[0];

      let query = `
        SELECT l.*, (l.seller_id = $1) AS is_mine
        FROM listings l
        WHERE l.status = 'active' AND l.expires_at > now()`;
      const params: unknown[] = [userId];
      let idx = 2;

      if (scope === "community" && communityKey) {
        query += ` AND l.community_key = $${idx++}`;
        params.push(communityKey);
      } else {
        query += ` AND l.pin_code = $${idx++}`;
        params.push(pinCode);
      }

      if (category) {
        query += ` AND l.category = $${idx++}`;
        params.push(category);
      }
      if (kind && LISTING_KINDS.includes(kind as typeof LISTING_KINDS[number])) {
        query += ` AND l.kind = $${idx++}`;
        params.push(kind);
      }
      if (search?.trim()) {
        query += ` AND l.search_vector @@ plainto_tsquery('english', $${idx++})`;
        params.push(search.trim());
      }

      query += ` ORDER BY l.created_at DESC LIMIT 50`;

      const { rows } = await client.query(query, params);
      const listings = await Promise.all(
        rows.map(async (row) => {
          const media = await loadListingMedia(client, row.id);
          return mapListing(row, media);
        })
      );

      return c.json(listings);
    } finally {
      client.release();
    }
  });

  app.get("/mine", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT l.*, true AS is_mine
         FROM listings l
         WHERE l.seller_id = $1
         ORDER BY l.created_at DESC`,
        [userId]
      );
      const listings = await Promise.all(
        rows.map(async (row) => {
          const media = await loadListingMedia(client, row.id);
          return mapListing(row, media);
        })
      );
      return c.json(listings);
    } finally {
      client.release();
    }
  });

  app.post("/", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      kind?: string;
      category?: string;
      title?: string;
      description?: string;
      priceAmount?: number;
      schoolId?: string;
      gradeId?: string;
      media?: Array<{
        storageKey?: string;
        mimeType?: string;
        width?: number;
        height?: number;
      }>;
    }>();

    const kind = body.kind;
    const category = body.category?.trim();
    const title = body.title?.trim();
    if (!kind || !LISTING_KINDS.includes(kind as typeof LISTING_KINDS[number])) {
      return c.json({ error: "Invalid listing kind" }, 400);
    }
    if (!category || !LISTING_CATEGORIES.includes(category as typeof LISTING_CATEGORIES[number])) {
      return c.json({ error: "Invalid category" }, 400);
    }
    if (!title || title.length > 120) {
      return c.json({ error: "Title is required (max 120 characters)" }, 400);
    }
    if (kind === "for_sale" && (body.priceAmount == null || body.priceAmount < 0)) {
      return c.json({ error: "Price is required for items for sale" }, 400);
    }

    const mediaItems = Array.isArray(body.media) ? body.media : [];
    if (mediaItems.length > MAX_LISTING_MEDIA) {
      return c.json({ error: `Up to ${MAX_LISTING_MEDIA} photos allowed` }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const activeCount = await client.query(
        `SELECT COUNT(*)::int AS count FROM listings
         WHERE seller_id = $1 AND status = 'active'`,
        [userId]
      );
      if (activeCount.rows[0].count >= MAX_ACTIVE_LISTINGS) {
        await client.query("ROLLBACK");
        return c.json({ error: "You already have 10 active listings" }, 400);
      }

      const weeklyCount = await client.query(
        `SELECT COUNT(*)::int AS count FROM listings
         WHERE seller_id = $1 AND created_at > now() - interval '7 days'`,
        [userId]
      );
      if (weeklyCount.rows[0].count >= MAX_NEW_LISTINGS_PER_WEEK) {
        await client.query("ROLLBACK");
        return c.json({ error: "Listing limit reached for this week" }, 400);
      }

      const loc = await client.query(
        `SELECT pin_code, community_key FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (loc.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Set your location first" }, 400);
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const { rows } = await client.query(
        `INSERT INTO listings (
           seller_id, kind, category, title, description, price_amount,
           community_key, pin_code, school_id, grade_id, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userId,
          kind,
          category,
          title,
          body.description?.trim() || null,
          kind === "for_sale" ? body.priceAmount : null,
          loc.rows[0].community_key,
          loc.rows[0].pin_code,
          body.schoolId ?? null,
          body.gradeId ?? null,
          expiresAt.toISOString(),
        ]
      );

      const listingId = rows[0].id;
      for (const [index, item] of mediaItems.entries()) {
        if (!item.storageKey || !item.mimeType) {
          await client.query("ROLLBACK");
          return c.json({ error: "Invalid media attachment" }, 400);
        }
        await verifyListingMedia({
          userId,
          storageKey: item.storageKey,
          mimeType: item.mimeType,
        });
        await client.query(
          `INSERT INTO listing_media (listing_id, storage_key, mime_type, width, height, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            listingId,
            item.storageKey,
            item.mimeType,
            item.width ?? null,
            item.height ?? null,
            index,
          ]
        );
      }

      await client.query("COMMIT");

      await dispatchListingCreated({
        listingId,
        sellerId: userId,
        title,
        communityKey: loc.rows[0].community_key,
        pinCode: loc.rows[0].pin_code,
      });

      const media = await loadListingMedia(client, listingId);
      return c.json(mapListing({ ...rows[0], is_mine: true }, media), 201);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof Error && err.message.includes("MEDIA")) {
        return c.json({ error: "Invalid media attachment" }, 400);
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/:id", async (c) => {
    const userId = c.get("user").sub;
    const listingId = c.req.param("id");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT l.*, (l.seller_id = $2) AS is_mine
         FROM listings l
         WHERE l.id = $1`,
        [listingId, userId]
      );
      if (rows.length === 0) {
        return c.json({ error: "Listing not found" }, 404);
      }

      const listing = rows[0];
      if (
        listing.status !== "active" &&
        listing.seller_id !== userId
      ) {
        return c.json({ error: "Listing not found" }, 404);
      }

      const loc = await client.query(
        `SELECT pin_code, community_key FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (loc.rows.length > 0 && listing.seller_id !== userId) {
        const canView =
          (listing.community_key &&
            listing.community_key === loc.rows[0].community_key) ||
          listing.pin_code === loc.rows[0].pin_code;
        if (!canView) {
          return c.json({ error: "Listing not available in your area" }, 403);
        }
      }

      const media = await loadListingMedia(client, listingId);
      return c.json(mapListing(listing, media));
    } finally {
      client.release();
    }
  });

  app.patch("/:id", async (c) => {
    const userId = c.get("user").sub;
    const listingId = c.req.param("id");
    const body = await c.req.json<{ status?: string; title?: string; description?: string }>();

    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id, status FROM listings WHERE id = $1 AND seller_id = $2`,
        [listingId, userId]
      );
      if (existing.rows.length === 0) {
        return c.json({ error: "Listing not found" }, 404);
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (body.status) {
        if (!LISTING_STATUSES.includes(body.status as typeof LISTING_STATUSES[number])) {
          return c.json({ error: "Invalid status" }, 400);
        }
        fields.push(`status = $${i++}`);
        values.push(body.status);
        if (body.status === "completed") {
          fields.push(`completed_at = now()`);
        }
      }
      if (body.title !== undefined) {
        fields.push(`title = $${i++}`);
        values.push(body.title.trim());
      }
      if (body.description !== undefined) {
        fields.push(`description = $${i++}`);
        values.push(body.description.trim() || null);
      }

      if (fields.length === 0) {
        return c.json({ error: "No changes provided" }, 400);
      }

      fields.push(`updated_at = now()`);
      values.push(listingId, userId);

      await client.query(
        `UPDATE listings SET ${fields.join(", ")}
         WHERE id = $${i++} AND seller_id = $${i}`,
        values
      );

      const { rows } = await client.query(
        `SELECT l.*, true AS is_mine FROM listings l WHERE l.id = $1`,
        [listingId]
      );
      const media = await loadListingMedia(client, listingId);
      return c.json(mapListing(rows[0], media));
    } finally {
      client.release();
    }
  });

  app.post("/:id/interest", async (c) => {
    const userId = c.get("user").sub;
    const listingId = c.req.param("id");
    const client = await pool.connect();
    try {
      const listing = await client.query(
        `SELECT id, seller_id, title, status FROM listings WHERE id = $1`,
        [listingId]
      );
      if (listing.rows.length === 0 || listing.rows[0].status !== "active") {
        return c.json({ error: "Listing not found" }, 404);
      }

      const sellerId = listing.rows[0].seller_id;
      if (sellerId === userId) {
        return c.json({ error: "You cannot message yourself" }, 400);
      }

      if (await isBlocked(client, userId, sellerId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }

      const convId = await getOrCreateListingConversation(client, {
        listingId,
        sellerId,
        buyerId: userId,
      });

      const peer = await buildPeerView(client, {
        conversationId: convId,
        viewerId: userId,
      });

      const seller = await client.query(
        "SELECT push_token, notification_prefs FROM users WHERE id = $1",
        [sellerId]
      );
      if (seller.rows.length > 0) {
        await createNotification(client, {
          userId: sellerId,
          type: "listing_interest",
          title: "Someone is interested in your listing",
          body: listing.rows[0].title,
          data: { listingId, conversationId: convId },
          pushToken: seller.rows[0].push_token,
          notificationPrefs: seller.rows[0].notification_prefs,
          prefKey: "listings",
          delivery: "immediate",
        });
      }

      return c.json({
        conversationId: convId,
        peer,
      });
    } finally {
      client.release();
    }
  });

  return app;
}
