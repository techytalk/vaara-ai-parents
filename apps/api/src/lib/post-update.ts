import type { PoolClient } from "pg";
import type { MediaType } from "./media-storage.js";
import type { VerifiedDocument } from "./post-attachments.js";

export function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export type ExistingMediaRow = {
  id: string;
  storageKey: string;
};

export type IncomingMediaItem = {
  id?: string;
  storageKey?: string;
  mediaType?: MediaType;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

export type VerifiedNewMedia = {
  storageKey: string;
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type IncomingDocumentItem = {
  id?: string;
  storageKey?: string;
  fileName?: string;
  mimeType?: string;
};

async function loadExistingRows(
  client: PoolClient,
  postId: string,
  mediaTypes: string[]
): Promise<ExistingMediaRow[]> {
  const { rows } = await client.query(
    `SELECT id, storage_key
     FROM circle_post_media
     WHERE post_id = $1
       AND media_type::text = ANY($2::text[])
     ORDER BY sort_order`,
    [postId, mediaTypes]
  );
  return rows.map((row) => ({
    id: String(row.id),
    storageKey: String(row.storage_key),
  }));
}

export async function loadExistingMediaRows(
  client: PoolClient,
  postId: string
): Promise<ExistingMediaRow[]> {
  return loadExistingRows(client, postId, ["image", "video"]);
}

export async function applyMediaReplace(
  client: PoolClient,
  postId: string,
  incoming: IncomingMediaItem[],
  verifiedNewByKey: Map<string, VerifiedNewMedia>
): Promise<{ droppedKeys: string[]; changed: boolean }> {
  const existing = await loadExistingMediaRows(client, postId);
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byKey = new Map(existing.map((row) => [row.storageKey, row]));
  const usedIds = new Set<string>();
  const next: Array<{ keepId?: string; neu?: VerifiedNewMedia }> = [];

  for (const item of incoming) {
    if (item.id) {
      const row = byId.get(item.id);
      if (!row) throw new Error("UNKNOWN_MEDIA");
      if (usedIds.has(row.id)) throw new Error("DUPLICATE_MEDIA");
      usedIds.add(row.id);
      next.push({ keepId: row.id });
      continue;
    }

    if (item.storageKey && byKey.has(item.storageKey)) {
      const row = byKey.get(item.storageKey)!;
      if (usedIds.has(row.id)) throw new Error("DUPLICATE_MEDIA");
      usedIds.add(row.id);
      next.push({ keepId: row.id });
      continue;
    }

    if (item.storageKey && verifiedNewByKey.has(item.storageKey)) {
      next.push({ neu: verifiedNewByKey.get(item.storageKey) });
      continue;
    }

    throw new Error("INVALID_MEDIA");
  }

  const keepIds = new Set(
    next.flatMap((item) => (item.keepId ? [item.keepId] : []))
  );
  const dropped = existing.filter((row) => !keepIds.has(row.id));
  const changed =
    dropped.length > 0 ||
    next.some((item) => item.neu) ||
    next.length !== existing.length ||
    next.some(
      (item, index) => item.keepId && item.keepId !== existing[index]?.id
    );

  if (dropped.length > 0) {
    await client.query(
      `DELETE FROM circle_post_media WHERE id = ANY($1::uuid[])`,
      [dropped.map((row) => row.id)]
    );
  }

  for (const [index, item] of next.entries()) {
    if (item.keepId) {
      await client.query(
        `UPDATE circle_post_media SET sort_order = $2 WHERE id = $1`,
        [item.keepId, index]
      );
      continue;
    }
    const neu = item.neu;
    if (!neu) continue;
    await client.query(
      `INSERT INTO circle_post_media
         (post_id, storage_key, media_type, mime_type, size_bytes,
          width, height, duration_ms, sort_order, scan_status, scanned_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'clean', now())`,
      [
        postId,
        neu.storageKey,
        neu.mediaType,
        neu.mimeType,
        neu.sizeBytes,
        neu.width,
        neu.height,
        neu.durationMs,
        index,
      ]
    );
  }

  return { droppedKeys: dropped.map((row) => row.storageKey), changed };
}

export async function applyDocumentReplace(
  client: PoolClient,
  postId: string,
  incoming: IncomingDocumentItem[],
  verifiedNewByKey: Map<string, VerifiedDocument>
): Promise<{ droppedKeys: string[]; changed: boolean }> {
  const existing = await loadExistingRows(client, postId, ["document"]);
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byKey = new Map(existing.map((row) => [row.storageKey, row]));
  const usedIds = new Set<string>();
  const next: Array<{ keepId?: string; neu?: VerifiedDocument }> = [];

  for (const item of incoming) {
    if (item.id) {
      const row = byId.get(item.id);
      if (!row) throw new Error("UNKNOWN_MEDIA");
      if (usedIds.has(row.id)) throw new Error("DUPLICATE_MEDIA");
      usedIds.add(row.id);
      next.push({ keepId: row.id });
      continue;
    }

    if (item.storageKey && byKey.has(item.storageKey)) {
      const row = byKey.get(item.storageKey)!;
      if (usedIds.has(row.id)) throw new Error("DUPLICATE_MEDIA");
      usedIds.add(row.id);
      next.push({ keepId: row.id });
      continue;
    }

    if (item.storageKey && verifiedNewByKey.has(item.storageKey)) {
      next.push({ neu: verifiedNewByKey.get(item.storageKey) });
      continue;
    }

    throw new Error("INVALID_MEDIA");
  }

  const keepIds = new Set(
    next.flatMap((item) => (item.keepId ? [item.keepId] : []))
  );
  const dropped = existing.filter((row) => !keepIds.has(row.id));
  const changed =
    dropped.length > 0 ||
    next.some((item) => item.neu) ||
    next.length !== existing.length ||
    next.some(
      (item, index) => item.keepId && item.keepId !== existing[index]?.id
    );

  if (dropped.length > 0) {
    await client.query(
      `DELETE FROM circle_post_media WHERE id = ANY($1::uuid[])`,
      [dropped.map((row) => row.id)]
    );
  }

  const mediaCountResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM circle_post_media
     WHERE post_id = $1 AND media_type IN ('image', 'video')`,
    [postId]
  );
  const sortStart = Number(mediaCountResult.rows[0]?.count ?? 0);

  for (const [index, item] of next.entries()) {
    if (item.keepId) {
      await client.query(
        `UPDATE circle_post_media SET sort_order = $2 WHERE id = $1`,
        [item.keepId, sortStart + index]
      );
      continue;
    }
    const neu = item.neu;
    if (!neu) continue;
    await client.query(
      `INSERT INTO circle_post_media
         (post_id, storage_key, media_type, mime_type, size_bytes,
          file_name, scan_status, scanned_at, sort_order)
       VALUES ($1, $2, 'document', $3, $4, $5, 'clean', now(), $6)`,
      [
        postId,
        neu.storageKey,
        neu.mimeType,
        neu.sizeBytes,
        neu.fileName,
        sortStart + index,
      ]
    );
  }

  return { droppedKeys: dropped.map((row) => row.storageKey), changed };
}
