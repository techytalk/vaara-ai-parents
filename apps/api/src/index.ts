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
import { pool } from "@vaara/db";
import { processPendingReminders } from "./services/notifications.js";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/v1/auth", createAuthRoutes());
app.route("/v1/me", createMeRoutes());
app.route("/v1/circles", createCirclesRoutes());
app.route("/v1/conversations", createConversationsRoutes());
app.route("/v1/reference", createReferenceRoutes());
app.route("/v1/schools", createSchoolsRoutes());
app.route("/v1/media", createMediaRoutes());
app.route("/v1/provider", createProviderRoutes());
app.route("/v1/activities", createActivitiesRoutes());
app.route("/v1/app", createAppRoutes());
app.route("/internal", createInternalRoutes());

const port = Number(process.env.PORT ?? 3000);
console.log(`API listening on http://localhost:${port}`);

if (process.env.CRON_SECRET) {
  const intervalMs = Number(process.env.CRON_INTERVAL_MS ?? 60000);
  setInterval(async () => {
    const client = await pool.connect();
    try {
      const sent = await processPendingReminders(client);
      if (sent > 0) {
        console.log(`Cron: sent ${sent} reminder(s)`);
      }
    } catch (err) {
      console.error("Cron reminder processing failed:", err);
    } finally {
      client.release();
    }
  }, intervalMs);
  console.log(`Reminder cron running every ${intervalMs}ms`);
}

serve({ fetch: app.fetch, port });
