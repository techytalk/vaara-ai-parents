import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { Context, Next } from "hono";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import { isBlocked } from "../lib/author.js";
import { mediaPublicUrl } from "../lib/media-storage.js";
import {
  escapeHtml,
  publicShareUrl,
} from "../lib/post-shares.js";
import {
  isShareActive,
  loadShareTarget,
  resolveThreadAccess,
} from "../lib/thread-access.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";

type ShareVariables = {
  user?: JwtPayload;
};

async function optionalAuth(c: Context<{ Variables: ShareVariables }>, next: Next) {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      c.set("user", await verifyToken(header.slice(7)));
    } catch {
      // Treat invalid tokens as anonymous for public share pages.
    }
  }
  await next();
}

function previewSnippet(text: string, max = 180): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function sharePageHtml(params: {
  title: string;
  description: string;
  image?: string | null;
  url: string;
  heading: string;
  body: string;
  iosStore: string;
  androidStore: string;
}): string {
  const title = escapeHtml(params.title);
  const description = escapeHtml(params.description);
  const url = escapeHtml(params.url);
  const image = params.image ? escapeHtml(params.image) : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex,nofollow" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #FFFCF7; color: #0D1B2A; }
    main { max-width: 28rem; margin: 3rem auto; padding: 0 1.25rem; }
    a { color: #0E9A8A; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(params.heading)}</h1>
    <p>${escapeHtml(params.body)}</p>
    <p><a href="${url}">Open in Vaara Parents</a></p>
    <p>
      <a href="${escapeHtml(params.iosStore)}">App Store</a>
      ·
      <a href="${escapeHtml(params.androidStore)}">Google Play</a>
    </p>
  </main>
</body>
</html>`;
}

export function createShareRoutes() {
  const app = new Hono<{ Variables: ShareVariables }>();
  app.use("*", optionalAuth);
  app.use(
    "*",
    rateLimitMiddleware({
      prefix: "post-share-resolve",
      limit: 60,
      windowSeconds: 60,
      keyFn: (c) =>
        c.get("user")?.sub ?? c.req.header("x-forwarded-for") ?? "anon",
    }) as never
  );

  async function loadPreview(shareId: string, userId?: string) {
    const client = await pool.connect();
    try {
      const share = await loadShareTarget(client, shareId);
      if (!share || !isShareActive(share)) {
        return { status: "unavailable" as const };
      }

      const post = await client.query(
        `SELECT p.id, p.body, p.tag, p.author_id, u.anonymous_handle,
                c.display_name,
                (SELECT question FROM post_polls WHERE post_id = p.id LIMIT 1) AS poll_question,
                (
                  SELECT storage_key FROM circle_post_media
                  WHERE post_id = p.id AND media_type = 'image'
                  ORDER BY sort_order LIMIT 1
                ) AS image_key
         FROM circle_posts p
         JOIN users u ON u.id = p.author_id
         JOIN circles c ON c.id = $2
         WHERE p.id = $1`,
        [share.postId, share.circleId]
      );
      if (post.rows.length === 0) {
        return { status: "unavailable" as const };
      }
      const row = post.rows[0];
      if (userId && (await isBlocked(client, userId, String(row.author_id)))) {
        return { status: "unavailable" as const };
      }

      let accessState:
        | "member"
        | "author"
        | "share_preview"
        | "login_required" = "login_required";
      if (userId) {
        const access = await resolveThreadAccess(client, {
          userId,
          circleId: share.circleId,
          postId: share.postId,
          shareId,
        });
        if (access.state === "denied") {
          return { status: "unavailable" as const };
        }
        accessState =
          access.state === "member" || access.state === "author"
            ? access.state
            : "share_preview";
      }

      let imageUrl: string | null = null;
      if (row.image_key) {
        try {
          imageUrl = mediaPublicUrl(String(row.image_key));
        } catch {
          imageUrl = null;
        }
      }

      return {
        status: "ok" as const,
        shareId,
        circleId: share.circleId,
        postId: share.postId,
        access: accessState,
        url: publicShareUrl(shareId),
        preview: {
          body: previewSnippet(String(row.body || row.poll_question || "A parent post")),
          tag: row.tag,
          pollQuestion: row.poll_question,
          authorHandle: row.anonymous_handle,
          circleName: row.display_name,
          imageUrl,
        },
      };
    } finally {
      client.release();
    }
  }

  app.get("/:shareId/page", async (c) => {
    const shareId = c.req.param("shareId");
    const userId = c.get("user")?.sub;
    const result = await loadPreview(shareId, userId);
    const iosStore =
      process.env.IOS_STORE_URL ?? "https://apps.apple.com/app/vaara-parents";
    const androidStore =
      process.env.ANDROID_STORE_URL ??
      "https://play.google.com/store/apps/details?id=com.vaara.parents";
    if (result.status !== "ok") {
      return c.html(
        sharePageHtml({
          title: "This post is no longer available",
          description: "This Vaara Parents post is no longer available.",
          url: publicShareUrl(shareId),
          heading: "This post is no longer available",
          body: "The link may have expired, or the post was removed.",
          iosStore,
          androidStore,
        }),
        404
      );
    }
    return c.html(
      sharePageHtml({
        title: "A parent shared a post on Vaara Parents",
        description: result.preview.body,
        image: result.preview.imageUrl,
        url: result.url,
        heading: "A parent shared a post on Vaara Parents",
        body: result.preview.body,
        iosStore,
        androidStore,
      })
    );
  });

  app.get("/:shareId", async (c) => {
    const shareId = c.req.param("shareId");
    const userId = c.get("user")?.sub;
    const result = await loadPreview(shareId, userId);
    if (result.status !== "ok") {
      return c.json({ available: false, error: "This post is no longer available" }, 404);
    }
    return c.json({ available: true, ...result });
  });

  return app;
}
