import { Hono } from "hono";
import { pool } from "@vaara/db";
import {
  MAX_POST_MEDIA,
  type MediaType,
  verifyUploadedMedia,
} from "../lib/media-storage.js";
import { validatePollInput } from "../lib/polls.js";
import { syncCircleMembership } from "../services/circle-sync.js";
import {
  createCrossPosts,
  dispatchCrossPostsCreated,
  searchCircleDirectory,
  toCircleTargets,
} from "../services/cross-posts.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const POST_TAGS = ["question", "recommendation", "heads_up", "general"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCrossPostRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  const postRateLimit = rateLimitMiddleware({
    prefix: "cross-post",
    limit: 10,
    windowSeconds: 3600,
  });

  app.post("/", postRateLimit, async (c) => {
    const userId = c.get("user").sub;
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
    if (
      !text &&
      (!Array.isArray(body.media) || body.media.length === 0) &&
      !body.poll
    ) {
      return c.json(
        { error: "A message, poll, or attachment is required" },
        400
      );
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
    if (!POST_TAGS.includes(tag as (typeof POST_TAGS)[number])) {
      return c.json({ error: "Invalid tag" }, 400);
    }

    const targetCircleIds = Array.isArray(body.targetCircleIds)
      ? body.targetCircleIds
      : [];
    if (targetCircleIds.some((id) => !UUID_PATTERN.test(id))) {
      return c.json({ error: "Invalid target circle" }, 400);
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
      await syncCircleMembership(client, userId);

      const result = await createCrossPosts(client, {
        userId,
        body: text,
        tag,
        targetCircleIds,
        media: verifiedMedia,
        poll: body.poll
          ? {
              question: body.poll.question ?? "",
              options: body.poll.options ?? [],
              hideResultsUntilVote: body.poll.hideResultsUntilVote,
              closesAt: body.poll.closesAt,
            }
          : undefined,
        topicSlugs: body.topicSlugs,
      });

      if (result.ok === false) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status);
      }

      await client.query("COMMIT");

      const targets = toCircleTargets(result.circleRows);
      await dispatchCrossPostsCreated({
        userId,
        body: text,
        pollQuestion: body.poll?.question,
        postId: result.postId,
        classifiedTargets: targets,
        topicIds: result.topicIds,
        topicSlugs: result.topicSlugs,
      });

      return c.json(
        {
          groupId: result.groupId,
          postId: result.postId,
          primaryCircleId: result.primaryCircleId,
          posts: result.posts,
          guestQuota: result.guestQuota,
        },
        201
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  return app;
}

export function registerCircleDirectoryRoute(
  app: Hono<{ Variables: AuthVariables }>
) {
  app.get("/directory", async (c) => {
    const userId = c.get("user").sub;
    const q = c.req.query("q");
    const type = c.req.query("type");
    const limit = Number(c.req.query("limit") ?? 30);

    const client = await pool.connect();
    try {
      await syncCircleMembership(client, userId);
      const result = await searchCircleDirectory(client, userId, {
        q,
        type,
        limit,
      });
      return c.json(result);
    } finally {
      client.release();
    }
  });
}
