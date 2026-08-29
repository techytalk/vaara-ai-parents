import "./env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes } from "./routes/auth.js";
import { createMeRoutes } from "./routes/me.js";
import {
  createCirclesRoutes,
  createConversationsRoutes,
} from "./routes/circles.js";
import { createReferenceRoutes } from "./routes/reference.js";
import {
  createActivitiesRoutes,
  createProviderRoutes,
} from "./routes/activities.js";
import { createInternalRoutes } from "./routes/internal.js";
import { createAppRoutes } from "./routes/app.js";
import { createSchoolsRoutes } from "./routes/schools.js";
import { createMediaRoutes } from "./routes/media.js";
import {
  createProviderReviewReplyRoutes,
  createProviderReviewRoutes,
} from "./routes/reviews.js";
import { createListingRoutes } from "./routes/listings.js";
import { createSchoolEventsRoutes } from "./routes/school-events.js";
import { createTopicsRoutes } from "./routes/topics.js";
import { createPractitionerRoutes } from "./routes/practitioners.js";
import { createExpertSessionRoutes } from "./routes/expert-sessions.js";
import { createPlaydateRoutes } from "./routes/playdates.js";
import { createCarpoolRoutes } from "./routes/carpool.js";
import { getRedis, isRedisEnabled } from "@vaara/redis";

const app = new Hono();

app.use("*", cors());

app.get("/health", async (c) => {
  let redis = false;
  if (isRedisEnabled()) {
    try {
      await getRedis().ping();
      redis = true;
    } catch {
      redis = false;
    }
  }

  return c.json({
    status: "ok",
    redis,
  });
});

app.route("/v1/auth", createAuthRoutes());
app.route("/v1/me", createMeRoutes());
app.route("/v1/circles", createCirclesRoutes());
app.route("/v1/conversations", createConversationsRoutes());
app.route("/v1/reference", createReferenceRoutes());
app.route("/v1/schools", createSchoolsRoutes());
app.route("/v1/media", createMediaRoutes());
app.route("/v1/provider", createProviderRoutes());
app.route("/v1/activities", createActivitiesRoutes());
app.route("/v1/listings", createListingRoutes());
app.route("/v1/topics", createTopicsRoutes());
app.route("/v1/school-events", createSchoolEventsRoutes());
app.route("/v1/practitioners", createPractitionerRoutes());
app.route("/v1/expert-sessions", createExpertSessionRoutes());
app.route("/v1/playdates", createPlaydateRoutes());
app.route("/v1/carpool", createCarpoolRoutes());
app.route("/v1/providers", createProviderReviewRoutes());
app.route("/v1/provider/reviews", createProviderReviewReplyRoutes());
app.route("/v1/app", createAppRoutes());
app.route("/internal", createInternalRoutes());

export default app;

const isVercel = Boolean(process.env.VERCEL);

if (!isVercel) {
  const port = Number(process.env.PORT ?? 3000);
  console.log(`API listening on http://localhost:${port}`);
  if (!isRedisEnabled()) {
    console.warn(
      "REDIS_URL not set — running without cache, queues, or realtime pub/sub"
    );
  }
  serve({ fetch: app.fetch, port });
}
