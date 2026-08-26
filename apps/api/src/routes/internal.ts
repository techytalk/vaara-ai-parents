import { Hono } from "hono";
import { pool } from "@vaara/db";
import { processBackgroundJobs } from "../services/notifications.js";

export function createInternalRoutes() {
  const app = new Hono();

  app.post("/cron/reminders", async (c) => {
    const secret = c.req.header("X-Cron-Secret");
    const expected = process.env.CRON_SECRET;

    if (!expected || secret !== expected) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const client = await pool.connect();
    try {
      const result = await processBackgroundJobs(client);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  return app;
}
