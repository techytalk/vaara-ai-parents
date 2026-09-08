import { Hono } from "hono";
import { pool } from "@vaara/db";
import {
  applyGuardDutyScanResult,
  createDocumentDownloadUrl,
  createListingMediaUpload,
  createMediaUpload,
  isMediaStorageConfigured,
  type MediaType,
  resolveDocumentScanStatus,
  validateMediaRequest,
  verifyUploadedDocument,
} from "../lib/media-storage.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

function mapDocumentError(error: unknown): {
  status: 400 | 403 | 500;
  message: string;
} {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Could not process document" };
  }
  switch (error.message) {
    case "INVALID_MEDIA_OWNER":
    case "INVALID_MEDIA_KEY":
      return { status: 403, message: "You do not own this file" };
    case "MEDIA_MIME_MISMATCH":
      return {
        status: 400,
        message: "File type did not match what was declared",
      };
    case "INVALID_DOCUMENT_FORMAT":
      return {
        status: 400,
        message: "This file is not a valid PDF, Word, or Excel document",
      };
    case "MACROS_NOT_ALLOWED":
      return {
        status: 400,
        message: "Office files with macros are not allowed",
      };
    case "EMPTY_OBJECT":
      return { status: 400, message: "Uploaded file was empty" };
    case "MEDIA_STORAGE_NOT_CONFIGURED":
      return { status: 500, message: "Media uploads are not configured" };
    default:
      if (
        error.message.includes("must be") ||
        error.message.includes("Only PDF") ||
        error.message.includes("not allowed") ||
        error.message.includes("extension")
      ) {
        return { status: 400, message: error.message };
      }
      return { status: 500, message: "Could not process document" };
  }
}

export function createMediaRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();

  // GuardDuty / EventBridge callback — shared secret, not user JWT.
  app.post("/documents/scan-callback", async (c) => {
    const expected = process.env.GUARDDUTY_CALLBACK_SECRET?.trim();
    if (!expected) {
      return c.json({ error: "Scan callback is not configured" }, 503);
    }
    const provided =
      c.req.header("x-vaara-scan-secret") ??
      c.req.header("x-guardduty-callback-secret");
    if (!provided || provided !== expected) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json<{
      detail?: {
        s3ObjectDetails?: { objectKey?: string };
        scanResultDetails?: { scanStatus?: string };
        scanStatus?: string;
      };
      storageKey?: string;
      scanStatus?: string;
    }>();

    const storageKey =
      body.storageKey ?? body.detail?.s3ObjectDetails?.objectKey ?? null;
    const scanStatus =
      body.scanStatus ??
      body.detail?.scanResultDetails?.scanStatus ??
      body.detail?.scanStatus ??
      null;

    if (!storageKey || !scanStatus) {
      return c.json({ error: "storageKey and scanStatus are required" }, 400);
    }

    try {
      const result = await applyGuardDutyScanResult({
        storageKey,
        scanStatus,
      });
      return c.json({ ok: true, result });
    } catch (error) {
      console.error("[media] scan callback failed", error);
      return c.json({ error: "Could not apply scan result" }, 500);
    }
  });

  app.use("*", authMiddleware);

  app.get("/status", (c) =>
    c.json({ configured: isMediaStorageConfigured() })
  );

  app.post("/upload-url", async (c) => {
    if (!isMediaStorageConfigured()) {
      return c.json({ error: "Media uploads are not configured" }, 503);
    }

    const userId = c.get("user").sub;
    const body = await c.req.json<{
      fileName?: string;
      mediaType?: MediaType;
      mimeType?: string;
      sizeBytes?: number;
      purpose?: "post" | "listing";
    }>();

    const fileName = body.fileName?.trim() || "upload";
    const mediaType = body.mediaType;
    const mimeType = body.mimeType?.trim().toLowerCase();
    const sizeBytes = Number(body.sizeBytes);

    if (
      mediaType !== "image" &&
      mediaType !== "video" &&
      mediaType !== "document"
    ) {
      return c.json({ error: "Invalid media type" }, 400);
    }
    if (!mimeType) return c.json({ error: "MIME type is required" }, 400);

    const validationError = validateMediaRequest({
      mediaType,
      mimeType,
      sizeBytes,
      fileName,
    });
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    try {
      if (body.purpose === "listing") {
        if (mediaType !== "image") {
          return c.json({ error: "Listing photos must be images" }, 400);
        }
        return c.json(
          await createListingMediaUpload({
            userId,
            fileName,
            mimeType,
            sizeBytes,
          })
        );
      }

      return c.json(
        await createMediaUpload({
          userId,
          fileName,
          mediaType,
          mimeType,
          sizeBytes,
        })
      );
    } catch (error) {
      console.error("Could not create media upload URL", error);
      const mapped = mapDocumentError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  });

  app.post("/documents/verify", async (c) => {
    if (!isMediaStorageConfigured()) {
      return c.json({ error: "Media uploads are not configured" }, 503);
    }

    const userId = c.get("user").sub;
    const body = await c.req.json<{
      storageKey?: string;
      fileName?: string;
      mimeType?: string;
    }>();

    const storageKey = body.storageKey?.trim();
    const fileName = body.fileName?.trim();
    const mimeType = body.mimeType?.trim().toLowerCase();
    if (!storageKey || !fileName || !mimeType) {
      return c.json(
        { error: "storageKey, fileName, and mimeType are required" },
        400
      );
    }

    try {
      const result = await verifyUploadedDocument({
        userId,
        storageKey,
        fileName,
        mimeType,
      });
      return c.json(result);
    } catch (error) {
      console.error("[media] document verify failed", error);
      const mapped = mapDocumentError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  });

  app.get("/documents/status", async (c) => {
    if (!isMediaStorageConfigured()) {
      return c.json({ error: "Media uploads are not configured" }, 503);
    }

    const userId = c.get("user").sub;
    const storageKey = c.req.query("storageKey")?.trim();
    if (!storageKey) {
      return c.json({ error: "storageKey is required" }, 400);
    }

    try {
      const result = await resolveDocumentScanStatus({ userId, storageKey });
      return c.json(result);
    } catch (error) {
      console.error("[media] document status failed", error);
      const mapped = mapDocumentError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  });

  app.get("/:mediaId/download", async (c) => {
    if (!isMediaStorageConfigured()) {
      return c.json({ error: "Media uploads are not configured" }, 503);
    }

    const userId = c.get("user").sub;
    const mediaId = c.req.param("mediaId");

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT m.id, m.storage_key, m.mime_type, m.file_name, m.scan_status,
                m.media_type, m.post_id
         FROM circle_post_media m
         WHERE m.id = $1`,
        [mediaId]
      );
      const row = rows[0];
      if (
        !row ||
        row.media_type !== "document" ||
        row.scan_status !== "clean" ||
        !row.file_name
      ) {
        return c.json({ error: "Document not found" }, 404);
      }

      const access = await client.query(
        `SELECT 1
         FROM circle_post_targets t
         JOIN circle_members cm ON cm.circle_id = t.circle_id
         WHERE t.post_id = $1 AND cm.user_id = $2
         LIMIT 1`,
        [row.post_id, userId]
      );
      if (access.rows.length === 0) {
        return c.json({ error: "You do not have access to this document" }, 403);
      }

      const download = await createDocumentDownloadUrl({
        storageKey: String(row.storage_key),
        fileName: String(row.file_name),
        mimeType: String(row.mime_type),
      });
      return c.json(download);
    } catch (error) {
      console.error("[media] document download failed", error);
      return c.json({ error: "Could not prepare download" }, 500);
    } finally {
      client.release();
    }
  });

  return app;
}
