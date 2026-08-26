import { Hono } from "hono";
import { pool } from "@vaara/db";
import { processPendingReminders } from "../services/notifications.js";

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
      const sent = await processPendingReminders(client);
      return c.json({ ok: true, remindersSent: sent });
    } finally {
      client.release();
    }
  });

  return app;
}
