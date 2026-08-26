import { Hono } from "hono";
import {
  createListingMediaUpload,
  createMediaUpload,
  isMediaStorageConfigured,
  type MediaType,
  validateMediaRequest,
} from "../lib/media-storage.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

export function createMediaRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
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

    if (mediaType !== "image" && mediaType !== "video") {
      return c.json({ error: "Invalid media type" }, 400);
    }
    if (!mimeType) return c.json({ error: "MIME type is required" }, 400);

    const validationError = validateMediaRequest({
      mediaType,
      mimeType,
      sizeBytes,
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
      return c.json({ error: "Could not prepare media upload" }, 500);
    }
  });

  return app;
}
