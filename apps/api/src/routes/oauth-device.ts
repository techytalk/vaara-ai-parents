import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { pool } from "@vaara/db";
import { isValidEmail, normalizeEmail } from "@vaara/shared/auth-input";
import { clientIp, rateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  oauthCookieName,
  randomToken,
  readLoginCookie,
  sha256,
  signLoginCookie,
} from "../lib/oauth.js";
import { issuePrepSession } from "../lib/prep-session.js";
import { authOrigin, emailHmac, encryptEmail, jeePrepOrigin, sendPrepApprovalEmail } from "../lib/prep-mail.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function userCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = Buffer.from(randomToken());
  for (let i = 0; i < 8; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

export function createOAuthDeviceRoutes() {
  const app = new Hono();
  const limit = rateLimitMiddleware({
    prefix: "oauth-device",
    limit: 20,
    windowSeconds: 60 * 60,
    keyFn: clientIp,
  });

  app.post("/device/code", limit, async (c) => {
    const body = await c.req.json().catch(() => null) as {
      nickname?: string;
      classBand?: string;
      ageBand?: string;
      parentEmail?: string;
      client_id?: string;
    } | null;
    const nickname = body?.nickname?.trim() ?? "";
    const classBand = body?.classBand?.trim() ?? "";
    const ageBand = body?.ageBand?.trim() ?? "";
    const email = normalizeEmail(body?.parentEmail);
    const clientId = body?.client_id || "jee";
    if (!nickname || nickname.length > 40 || !classBand || !ageBand || !isValidEmail(email)) {
      return c.json({ error: "Enter a nickname, class, age, and parent email." }, 400);
    }
    const hmac = emailHmac(email);
    const blocked = await pool.query(`SELECT 1 FROM email_suppressions WHERE email_hmac = $1`, [hmac]);
    if (blocked.rows.length > 0) return c.json({ error: "This email cannot be used." }, 400);
    const recent = await pool.query(
      `SELECT count(*)::int AS n FROM oauth_device_requests
       WHERE parent_email_hmac = $1 AND created_at > now() - interval '24 hours'`,
      [hmac]
    );
    if ((recent.rows[0]?.n as number) >= 3) {
      return c.json({ error: "Too many requests for this email today." }, 429);
    }

    const device = randomToken();
    const code = userCode();
    await pool.query(
      `INSERT INTO oauth_device_requests
        (device_code_hash, user_code, client_id, nickname, class_band, age_band, parent_email_enc, parent_email_hmac, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '7 days')`,
      [sha256(device), code, clientId, nickname, classBand, ageBand, encryptEmail(email), hmac]
    );
    const sent = await sendPrepApprovalEmail({ to: email, nickname, classBand, userCode: code });
    return c.json({
      device_code: device,
      user_code: code,
      verification_uri: `${authOrigin()}/oauth/device?user_code=${encodeURIComponent(code)}`,
      emailed: sent,
      expires_in: 7 * 24 * 60 * 60,
      interval: 5,
    });
  });

  app.post("/device/token", limit, async (c) => {
    const body = await c.req.json().catch(() => null) as { device_code?: string } | null;
    if (!body?.device_code) return c.json({ error: "invalid_request" }, 400);
    const { rows } = await pool.query(
      `SELECT id, status, parent_id, child_id, client_id, expires_at
       FROM oauth_device_requests WHERE device_code_hash = $1`,
      [sha256(body.device_code)]
    );
    const request = rows[0] as
      | { id: string; status: string; parent_id: string | null; child_id: string | null; client_id: string; expires_at: Date }
      | undefined;
    if (!request || new Date(request.expires_at) < new Date()) {
      return c.json({ error: "expired_token" }, 400);
    }
    if (request.status === "pending") return c.json({ error: "authorization_pending" }, 400);
    if (request.status !== "approved" || !request.parent_id || !request.child_id) {
      return c.json({ error: "access_denied" }, 400);
    }
    await pool.query(`UPDATE oauth_device_requests SET status = 'consumed', parent_email_enc = null WHERE id = $1`, [
      request.id,
    ]);
    return c.json(
      await issuePrepSession({
        clientId: request.client_id,
        parentId: request.parent_id,
        childId: request.child_id,
        deviceLabel: "Student device",
      })
    );
  });

  app.get("/device/block", async (c) => {
    const code = c.req.query("user_code") ?? "";
    const { rows } = await pool.query(
      `UPDATE oauth_device_requests
       SET status = 'declined', parent_email_enc = null
       WHERE user_code = $1 AND status = 'pending'
       RETURNING parent_email_hmac`,
      [code]
    );
    if (rows[0]?.parent_email_hmac) {
      await pool.query(
        `INSERT INTO email_suppressions (email_hmac, reason) VALUES ($1, 'not_my_child')
         ON CONFLICT (email_hmac) DO NOTHING`,
        [rows[0].parent_email_hmac]
      );
    }
    return c.html(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><p>We won't email this address about JEE Prep again.</p></body></html>`);
  });

  app.get("/device", async (c) => {
    const code = c.req.query("user_code") ?? "";
    if (!code) return c.text("Missing request code.", 400);
    setCookie(c, "vaara_oauth_device", code, { httpOnly: true, sameSite: "Lax", path: "/oauth", maxAge: 60 * 30 });
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session?.sub) {
      if (!session) {
        const token = await signLoginCookie({
          purpose: "oauth_login",
          clientId: "jee",
          redirectUri: `${jeePrepOrigin()}/auth/callback`,
          state: "device",
          codeChallenge: "device",
        });
        setCookie(c, oauthCookieName(), token, {
          httpOnly: true,
          sameSite: "Lax",
          secure: Boolean(process.env.VERCEL),
          path: "/oauth",
          maxAge: 60 * 30,
        });
      }
      return c.redirect("/oauth/login");
    }
    const { rows } = await pool.query(
      `SELECT nickname, class_band, age_band, status, expires_at
       FROM oauth_device_requests WHERE user_code = $1`,
      [code]
    );
    const request = rows[0] as { nickname: string; class_band: string; age_band: string; status: string; expires_at: Date } | undefined;
    if (!request || request.status !== "pending" || new Date(request.expires_at) < new Date()) {
      return c.html(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><p>This request is no longer waiting for approval.</p></body></html>`);
    }
    return c.html(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:28rem;margin:auto">
      <h1>Approve JEE Prep</h1>
      <p>${escapeHtml(request.nickname)} (${escapeHtml(request.class_band)}, ${escapeHtml(request.age_band)}) wants to join JEE Prep and keep a streak.</p>
      <form method="post" action="/oauth/device/approve">
        <input type="hidden" name="user_code" value="${escapeHtml(code)}" />
        <p><label><input type="checkbox" name="adult" value="yes" required /> I am the parent or legal guardian, and I am 18 or older.</label></p>
        <button type="submit">Approve</button>
      </form>
    </body></html>`);
  });

  app.post("/device/approve", limit, async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session?.sub) return c.redirect("/oauth/login");
    const body = await c.req.parseBody();
    if (body.adult !== "yes") return c.text("A parent has to confirm they are 18 or older.", 400);
    const code = typeof body.user_code === "string" ? body.user_code : "";
    const { rows } = await pool.query(
      `SELECT id, nickname, class_band FROM oauth_device_requests
       WHERE user_code = $1 AND status = 'pending' AND expires_at > now()`,
      [code]
    );
    const request = rows[0] as { id: string; nickname: string; class_band: string } | undefined;
    if (!request) return c.text("This request is no longer waiting.", 400);
    const classNumber = Number(request.class_band.replace("Class ", ""));
    const grade = await pool.query(
      `SELECT g.id, g.curriculum_id FROM curriculum_grades g
       JOIN curricula c ON c.id = g.curriculum_id
       WHERE c.code = 'CBSE' AND g.code = $1`,
      [`G${classNumber}`]
    );
    let childId: string | null = null;
    const existing = await pool.query(
      `SELECT id FROM children WHERE user_id = $1 AND lower(nickname) = lower($2) LIMIT 1`,
      [session.sub, request.nickname]
    );
    if (existing.rows[0]) childId = existing.rows[0].id as string;
    else if (grade.rows[0]) {
      const inserted = await pool.query(
        `INSERT INTO children (user_id, nickname, curriculum_id, grade_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [session.sub, request.nickname, grade.rows[0].curriculum_id, grade.rows[0].id]
      );
      childId = inserted.rows[0].id as string;
    }
    if (!childId) return c.text("Could not attach this student to a child.", 400);
    await pool.query(
      `UPDATE oauth_device_requests
       SET status = 'approved', parent_id = $2, child_id = $3, parent_email_enc = null
       WHERE id = $1`,
      [request.id, session.sub, childId]
    );
    deleteCookie(c, "vaara_oauth_device", { path: "/oauth" });
    return c.html(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><p>Approved. ${escapeHtml(request.nickname)} can keep practicing on this device.</p></body></html>`);
  });

  app.post("/invite/redeem", limit, async (c) => {
    const body = await c.req.json().catch(() => null) as { token?: string } | null;
    if (!body?.token) return c.json({ error: "invalid_request" }, 400);
    const { rows } = await pool.query(
      `SELECT id, child_id, parent_id, client_id FROM child_prep_links
       WHERE invite_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [sha256(body.token)]
    );
    const link = rows[0] as { id: string; child_id: string; parent_id: string; client_id: string } | undefined;
    if (!link) return c.json({ error: "invalid_grant" }, 400);
    await pool.query(`UPDATE child_prep_links SET used_at = now() WHERE id = $1`, [link.id]);
    return c.json(
      await issuePrepSession({
        clientId: link.client_id,
        parentId: link.parent_id,
        childId: link.child_id,
        deviceLabel: "Shared link",
      })
    );
  });

  app.post("/progress", limit, async (c) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const body = await c.req.json().catch(() => null) as {
      streak?: number;
      answeredCount?: number;
      accuracy?: number | null;
    } | null;
    if (!token || !body) return c.json({ error: "invalid_request" }, 400);
    const { rows } = await pool.query(
      `SELECT child_id, client_id FROM oauth_grants
       WHERE progress_token_hash = $1 AND revoked_at IS NULL`,
      [sha256(token)]
    );
    const grant = rows[0] as { child_id: string; client_id: string } | undefined;
    if (!grant) return c.json({ error: "invalid_token" }, 401);
    const streak = Math.max(0, Math.min(10000, Number(body.streak) || 0));
    const answered = Math.max(0, Math.min(100000, Number(body.answeredCount) || 0));
    const accuracy = body.accuracy == null ? null : Math.max(0, Math.min(100, Number(body.accuracy) || 0));
    await pool.query(
      `INSERT INTO child_prep_progress (child_id, client_id, streak, answered_count, accuracy, last_practiced_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (child_id) DO UPDATE
       SET streak = EXCLUDED.streak,
           answered_count = EXCLUDED.answered_count,
           accuracy = EXCLUDED.accuracy,
           last_practiced_at = now(),
           updated_at = now()`,
      [grant.child_id, grant.client_id, streak, answered, accuracy]
    );
    await pool.query(`UPDATE oauth_grants SET last_used_at = now() WHERE progress_token_hash = $1`, [sha256(token)]);
    return c.json({ ok: true });
  });

  return app;
}
