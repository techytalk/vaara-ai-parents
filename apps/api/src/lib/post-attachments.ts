import type { PoolClient } from "pg";
import { mediaPublicUrl } from "./media-storage.js";

export type PostMediaView = {
  id: string;
  type: "image" | "video";
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type PostDocumentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type LoadedPostAttachments = {
  media: PostMediaView[];
  documents: PostDocumentView[];
};

/** Load clean image/video media and clean documents for posts. */
export async function loadPostAttachments(
  client: PoolClient,
  postIds: string[]
): Promise<Map<string, LoadedPostAttachments>> {
  const result = new Map<string, LoadedPostAttachments>();
  if (postIds.length === 0) return result;

  for (const postId of postIds) {
    result.set(postId, { media: [], documents: [] });
  }

  const { rows } = await client.query(
    `SELECT id, post_id, storage_key, media_type, mime_type,
            width, height, duration_ms, file_name, size_bytes, scan_status
     FROM circle_post_media
     WHERE post_id = ANY($1::uuid[])
       AND scan_status = 'clean'
     ORDER BY post_id, sort_order`,
    [postIds]
  );

  for (const row of rows) {
    const bucket = result.get(row.post_id) ?? { media: [], documents: [] };
    if (row.media_type === "document") {
      if (row.file_name) {
        bucket.documents.push({
          id: String(row.id),
          fileName: String(row.file_name),
          mimeType: String(row.mime_type),
          sizeBytes: Number(row.size_bytes ?? 0),
        });
      }
    } else if (row.media_type === "image" || row.media_type === "video") {
      bucket.media.push({
        id: String(row.id),
        type: row.media_type as "image" | "video",
        url: mediaPublicUrl(String(row.storage_key)),
        mimeType: String(row.mime_type),
        width: row.width ?? null,
        height: row.height ?? null,
        durationMs: row.duration_ms ?? null,
      });
    }
    result.set(row.post_id, bucket);
  }

  return result;
}

export function emptyAttachments(): LoadedPostAttachments {
  return { media: [], documents: [] };
}

export type VerifiedDocument = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/** @deprecated alias — prefer VerifiedDocument */
export type VerifiedDocumentAlias = VerifiedDocument;

export async function insertPostDocuments(
  client: PoolClient,
  postId: string,
  documents: VerifiedDocument[],
  sortOrderStart = 0
): Promise<PostDocumentView[]> {
  const views: PostDocumentView[] = [];
  for (const [offset, item] of documents.entries()) {
    const inserted = await client.query(
      `INSERT INTO circle_post_media
         (post_id, storage_key, media_type, mime_type, size_bytes,
          file_name, scan_status, scanned_at, sort_order)
       VALUES ($1, $2, 'document', $3, $4, $5, 'clean', now(), $6)
       RETURNING id`,
      [
        postId,
        item.storageKey,
        item.mimeType,
        item.sizeBytes,
        item.fileName,
        sortOrderStart + offset,
      ]
    );
    views.push({
      id: String(inserted.rows[0].id),
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
    });
  }
  return views;
}
