import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function publicShareBaseUrl(): string {
  return (process.env.SHARE_PUBLIC_BASE_URL ?? "https://vaara.ai").replace(
    /\/+$/,
    ""
  );
}

export function publicShareUrl(shareId: string): string {
  return `${publicShareBaseUrl()}/p/${shareId}`;
}

function newShareId(): string {
  return randomBytes(16).toString("base64url");
}

export async function getOrCreatePostShare(
  client: PoolClient,
  params: {
    postId: string;
    circleId: string;
    userId: string;
  }
): Promise<{ shareId: string; url: string; expiresAt: string }> {
  const existing = await client.query(
    `SELECT id, expires_at
     FROM post_shares
     WHERE post_id = $1
       AND created_by = $2
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.postId, params.userId]
  );
  if (existing.rows.length > 0) {
    const shareId = String(existing.rows[0].id);
    return {
      shareId,
      url: publicShareUrl(shareId),
      expiresAt: existing.rows[0].expires_at,
    };
  }

  const shareId = newShareId();
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  await client.query(
    `INSERT INTO post_shares (id, post_id, created_by, target_circle_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [shareId, params.postId, params.userId, params.circleId, expiresAt]
  );
  return {
    shareId,
    url: publicShareUrl(shareId),
    expiresAt: expiresAt.toISOString(),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
