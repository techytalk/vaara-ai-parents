import type { PoolClient } from "pg";
import {
  MAX_POST_DOCUMENTS,
  MAX_POST_MEDIA,
  createChatMediaUrl,
  verifyCleanDocument,
  verifyUploadedMedia,
} from "./media-storage.js";

export type ChatAttachmentType = "image" | "video" | "document";

/** What the client sends alongside a message. */
export type ChatAttachmentInput = {
  storageKey: string;
  mediaType: ChatAttachmentType;
  mimeType: string;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

/** What the API returns on a message. */
export type ChatAttachmentView = {
  id: string;
  type: ChatAttachmentType;
  mimeType: string;
  sizeBytes: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /**
   * Signed, expiring URL for images and videos. Always `null` for documents —
   * those are fetched on demand through the chat download route, which applies
   * its own access check.
   */
  url: string | null;
};

type VerifiedChatAttachment = ChatAttachmentInput & {
  sizeBytes: number;
  fileName: string | null;
};

export type VerifyChatAttachmentsResult =
  | { ok: true; items: VerifiedChatAttachment[] }
  | { ok: false; error: string; status: number };

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

/**
 * Parse the raw `attachments` field from a request body. Rejects anything
 * malformed rather than silently dropping items, so a client bug surfaces as an
 * error instead of a message that quietly lost a photo.
 */
export function parseChatAttachments(
  raw: unknown
): { ok: true; items: ChatAttachmentInput[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "attachments must be a list" };

  const items: ChatAttachmentInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Invalid attachment" };
    }
    const item = entry as Record<string, unknown>;
    const storageKey = typeof item.storageKey === "string" ? item.storageKey.trim() : "";
    const mediaType = item.mediaType;
    const mimeType =
      typeof item.mimeType === "string" ? item.mimeType.trim().toLowerCase() : "";
    if (!storageKey) return { ok: false, error: "Attachment is missing its upload" };
    if (mediaType !== "image" && mediaType !== "video" && mediaType !== "document") {
      return { ok: false, error: "Invalid attachment type" };
    }
    if (!mimeType) return { ok: false, error: "Attachment is missing its file type" };

    const fileName =
      typeof item.fileName === "string" && item.fileName.trim()
        ? item.fileName.trim()
        : null;
    if (mediaType === "document" && !fileName) {
      return { ok: false, error: "Documents need a file name" };
    }

    items.push({
      storageKey,
      mediaType,
      mimeType,
      fileName,
      width: positiveInt(item.width),
      height: positiveInt(item.height),
      durationMs: positiveInt(item.durationMs),
    });
  }
  return { ok: true, items };
}

/**
 * Re-verify every attachment against S3 before it is attached to a message.
 *
 * Client-declared sizes are ignored; each object is measured with HeadObject,
 * and documents must already be scanned and promoted. Key ownership is enforced
 * by prefix, so one user cannot attach another user's upload.
 */
export async function verifyChatAttachments(params: {
  userId: string;
  attachments: ChatAttachmentInput[];
}): Promise<VerifyChatAttachmentsResult> {
  const { attachments } = params;
  if (attachments.length === 0) return { ok: true, items: [] };

  const keys = new Set<string>();
  for (const item of attachments) {
    if (keys.has(item.storageKey)) {
      return { ok: false, error: "The same file was attached twice", status: 400 };
    }
    keys.add(item.storageKey);
  }

  const mediaCount = attachments.filter((item) => item.mediaType !== "document").length;
  const documentCount = attachments.length - mediaCount;
  if (mediaCount > MAX_POST_MEDIA) {
    return {
      ok: false,
      error: `A message can include up to ${MAX_POST_MEDIA} photos or videos`,
      status: 400,
    };
  }
  if (documentCount > MAX_POST_DOCUMENTS) {
    return {
      ok: false,
      error: `A message can include up to ${MAX_POST_DOCUMENTS} documents`,
      status: 400,
    };
  }

  try {
    const items = await Promise.all(
      attachments.map(async (item): Promise<VerifiedChatAttachment> => {
        if (item.mediaType === "document") {
          const verified = await verifyCleanDocument({
            userId: params.userId,
            storageKey: item.storageKey,
            fileName: item.fileName ?? "document",
            mimeType: item.mimeType,
          });
          return {
            ...item,
            mimeType: verified.mimeType,
            fileName: verified.fileName,
            sizeBytes: verified.sizeBytes,
          };
        }
        const verified = await verifyUploadedMedia({
          userId: params.userId,
          storageKey: item.storageKey,
          mediaType: item.mediaType,
          mimeType: item.mimeType,
          scope: "chat",
        });
        return {
          ...item,
          mimeType: verified.mimeType,
          fileName: item.fileName ?? null,
          sizeBytes: verified.sizeBytes,
        };
      })
    );
    return { ok: true, items };
  } catch (error) {
    return { ok: false, ...mapAttachmentError(error) };
  }
}

function mapAttachmentError(error: unknown): { error: string; status: number } {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "INVALID_MEDIA_OWNER":
    case "INVALID_MEDIA_KEY":
      return { error: "You do not own this file", status: 403 };
    case "MEDIA_MIME_MISMATCH":
      return { error: "File type did not match what was declared", status: 400 };
    case "MEDIA_STORAGE_NOT_CONFIGURED":
      return { error: "Attachments are not configured", status: 500 };
    case "NotFound":
    case "NoSuchKey":
      return { error: "Upload was not found — try attaching it again", status: 400 };
    default:
      if (code.includes("must be") || code.includes("not allowed")) {
        return { error: code, status: 400 };
      }
      console.error("[chat] attachment verification failed", error);
      return { error: "Could not attach this file", status: 500 };
  }
}

export async function insertChatAttachments(
  client: PoolClient,
  messageId: string,
  attachments: VerifiedChatAttachment[]
): Promise<void> {
  for (const [index, item] of attachments.entries()) {
    await client.query(
      `INSERT INTO circle_message_media (
         message_id, storage_key, media_type, mime_type, size_bytes,
         width, height, duration_ms, file_name, scan_status, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'clean', $10)
       ON CONFLICT (message_id, storage_key) DO NOTHING`,
      [
        messageId,
        item.storageKey,
        item.mediaType,
        item.mimeType,
        item.sizeBytes,
        item.width ?? null,
        item.height ?? null,
        item.durationMs ?? null,
        item.fileName ?? null,
        index,
      ]
    );
  }
}

/**
 * Load attachments for a page of messages in one query, then sign media URLs.
 * Keyed by message ID so callers can attach without an N+1.
 */
export async function loadChatAttachments(
  client: PoolClient,
  messageIds: string[]
): Promise<Map<string, ChatAttachmentView[]>> {
  const result = new Map<string, ChatAttachmentView[]>();
  if (messageIds.length === 0) return result;
  for (const id of messageIds) result.set(id, []);

  const { rows } = await client.query(
    `SELECT id, message_id, storage_key, media_type, mime_type, size_bytes,
            width, height, duration_ms, file_name
     FROM circle_message_media
     WHERE message_id = ANY($1::uuid[])
       AND scan_status = 'clean'
     ORDER BY message_id, sort_order`,
    [messageIds]
  );

  await Promise.all(
    rows.map(async (row) => {
      const type = String(row.media_type);
      if (type !== "image" && type !== "video" && type !== "document") return;
      const storageKey = String(row.storage_key);
      const mimeType = String(row.mime_type);

      let url: string | null = null;
      if (type !== "document") {
        try {
          url = (await createChatMediaUrl({ storageKey, mimeType })).url;
        } catch (error) {
          // A missing signing config or a legacy non-chat key should degrade to
          // "no preview" rather than failing the whole page of messages.
          console.error("[chat] could not sign media url", error);
          url = null;
        }
      }

      const bucket = result.get(String(row.message_id));
      if (!bucket) return;
      bucket.push({
        id: String(row.id),
        type,
        mimeType,
        sizeBytes: Number(row.size_bytes ?? 0),
        fileName: row.file_name ? String(row.file_name) : null,
        width: row.width ?? null,
        height: row.height ?? null,
        durationMs: row.duration_ms ?? null,
        url,
      });
    })
  );

  // Promise.all resolves out of order; restore the sort_order the query applied.
  const orderByRow = new Map<string, number>();
  for (const [index, row] of rows.entries()) orderByRow.set(String(row.id), index);
  for (const list of result.values()) {
    list.sort((a, b) => (orderByRow.get(a.id) ?? 0) - (orderByRow.get(b.id) ?? 0));
  }

  return result;
}

/**
 * Human-readable stand-in when a message has attachments but no text.
 *
 * Without this, an attachment-only message shows a blank row everywhere a
 * preview is derived from `body`: the inbox, Home, thread lists, reply previews,
 * and push notifications.
 */
export function attachmentPreviewText(
  attachments: Array<{ type: ChatAttachmentType; fileName: string | null }>
): string {
  if (attachments.length === 0) return "";
  const photos = attachments.filter((item) => item.type === "image").length;
  const videos = attachments.filter((item) => item.type === "video").length;
  const documents = attachments.filter((item) => item.type === "document");

  if (photos > 0 && videos === 0 && documents.length === 0) {
    return photos === 1 ? "Photo" : `Photos (${photos})`;
  }
  if (videos > 0 && photos === 0 && documents.length === 0) {
    return videos === 1 ? "Video" : `Videos (${videos})`;
  }
  if (documents.length > 0 && photos === 0 && videos === 0) {
    if (documents.length === 1) return documents[0].fileName ?? "Document";
    return `Documents (${documents.length})`;
  }
  return `Attachments (${attachments.length})`;
}

/**
 * Preview labels for messages whose body is empty. Deliberately does not sign
 * URLs — previews only need the type and file name, and signing here would cost
 * one request per attachment on every inbox load.
 */
export async function loadAttachmentPreviewLabels(
  client: PoolClient,
  messageIds: string[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (messageIds.length === 0) return labels;

  const { rows } = await client.query(
    `SELECT message_id, media_type, file_name
     FROM circle_message_media
     WHERE message_id = ANY($1::uuid[])
       AND scan_status = 'clean'
     ORDER BY message_id, sort_order`,
    [messageIds]
  );

  const grouped = new Map<
    string,
    Array<{ type: ChatAttachmentType; fileName: string | null }>
  >();
  for (const row of rows) {
    const type = String(row.media_type);
    if (type !== "image" && type !== "video" && type !== "document") continue;
    const id = String(row.message_id);
    const list = grouped.get(id) ?? [];
    list.push({ type, fileName: row.file_name ? String(row.file_name) : null });
    grouped.set(id, list);
  }
  for (const [id, list] of grouped) {
    const label = attachmentPreviewText(list);
    if (label) labels.set(id, label);
  }
  return labels;
}
