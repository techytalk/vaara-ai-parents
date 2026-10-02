import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { pool } from "@vaara/db";
import { isValidEmail, normalizeDisplayName, normalizeEmail, passwordError } from "@vaara/shared/auth-input";
import { defaultAvatarKeyForHandle } from "../lib/avatar.js";
import { generateAnonymousHandle } from "../lib/anonymity.js";
import { verifyGoogleIdToken } from "../lib/google-auth.js";
import { clientIp, rateLimitMiddleware } from "../middleware/rate-limit.js";
import { issuePrepSession } from "../lib/prep-session.js";
import {
  oauthCookieName,
  pkceMatches,
  randomToken,
  readLoginCookie,
  sha256,
  signLoginCookie,
  signingKey,
  type OauthLoginClaims,
} from "../lib/oauth.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: sans-serif; background: #f6f3ee; color: #1c1917; margin: 0; }
    main { max-width: 28rem; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.4rem; }
    form, .card { background: white; border: 1px solid #e7e5e4; border-radius: 1rem; padding: 1rem; }
    label { display: block; font-size: 0.9rem; margin: 0.8rem 0; }
    input, button { font: inherit; }
    input[type="email"], input[type="password"] { width: 100%; box-sizing: border-box; padding: 0.6rem; border-radius: 0.7rem; border: 1px solid #d6d3d1; }
    button { background: #1c1917; color: white; border: 0; border-radius: 999px; padding: 0.7rem 1rem; }
    .error { color: #b91c1c; font-size: 0.9rem; }
    .choice { display: block; margin: 0.4rem 0; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

async function clientAllows(clientId: string, redirectUri: string) {
  const { rows } = await pool.query(
    `SELECT client_id, name, redirect_uris, pairwise_salt
     FROM oauth_clients WHERE client_id = $1`,
    [clientId]
  );
  const client = rows[0] as
    | { client_id: string; name: string; redirect_uris: string[]; pairwise_salt: string }
    | undefined;
  if (!client || !client.redirect_uris.includes(redirectUri)) return null;
  return client;
}

function writeLoginCookie(c: { header: (name: string, value: string) => void }, token: string) {
  setCookie(c as never, oauthCookieName(), token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: Boolean(process.env.VERCEL),
    path: "/oauth",
    maxAge: 30 * 60,
  });
}

export function createOAuthRoutes() {
  const app = new Hono();
  const limit = rateLimitMiddleware({
    prefix: "oauth",
    limit: 30,
    windowSeconds: 15 * 60,
    keyFn: clientIp,
  });

  app.use("*", async (c, next) => {
    if (!signingKey()) {
      return c.text("Sign in with Vaara is not configured.", 503);
    }
    await next();
  });

  app.get("/authorize", limit, async (c) => {
    const clientId = c.req.query("client_id") ?? "";
    const redirectUri = c.req.query("redirect_uri") ?? "";
    const state = c.req.query("state") ?? "";
    const challenge = c.req.query("code_challenge") ?? "";
    const method = c.req.query("code_challenge_method") ?? "";
    if (!clientId || !redirectUri || !state || !challenge || method !== "S256") {
      return c.text("Missing or invalid sign-in request.", 400);
    }
    const client = await clientAllows(clientId, redirectUri);
    if (!client) return c.text("This app is not allowed to sign in with Vaara.", 400);

    const token = await signLoginCookie({
      purpose: "oauth_login",
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    });
    writeLoginCookie(c, token);
    return c.redirect("/oauth/login");
  });

  app.get("/login", async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session) return c.text("Start sign-in from JEE Prep.", 400);
    if (session.sub) return c.redirect(nextAfterLogin(c));
    const error = c.req.query("error");
    const googleId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
    const google = googleId
      ? `<script src="https://accounts.google.com/gsi/client" async></script>
         <div id="g_id_onload" data-client_id="${escapeHtml(googleId)}" data-callback="onVaaraGoogle" data-auto_prompt="false"></div>
         <div class="g_id_signin" data-type="standard" data-theme="outline" data-text="continue_with" data-shape="pill"></div>
         <form id="google-form" method="post" action="/oauth/google"><input type="hidden" name="credential" /></form>
         <script>
           function onVaaraGoogle(response) {
             var form = document.getElementById("google-form");
             form.credential.value = response.credential;
             form.submit();
           }
         </script>
         <p>or</p>`
      : "";
    return c.html(
      page(
        "Sign in to Vaara",
        `<h1>Sign in to Vaara</h1>
         <p>JEE Prep is asking you to continue with your Vaara parent account.</p>
         ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
         ${google}
         <form method="post" action="/oauth/login">
           <label>Email <input type="email" name="email" required autocomplete="username" /></label>
           <label>Password <input type="password" name="password" required autocomplete="current-password" /></label>
           <button type="submit">Continue</button>
         </form>
         <p><a href="/oauth/signup">Create a Vaara account</a></p>`
      )
    );
  });

  app.post("/login", limit, async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session) return c.text("Start sign-in from JEE Prep.", 400);
    const body = await c.req.parseBody();
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";
    if (!isValidEmail(email) || !password) {
      return c.redirect("/oauth/login?error=Email+and+password+required");
    }

    const { rows } = await pool.query(
      `SELECT id, password_hash, role, google_sub, apple_sub, is_internal, internal_status
       FROM users WHERE email = $1`,
      [email]
    );
    const user = rows[0] as
      | {
          id: string;
          password_hash: string | null;
          role: string;
          google_sub: string | null;
          apple_sub: string | null;
          is_internal: boolean | null;
          internal_status: string | null;
        }
      | undefined;
    if (!user || user.role !== "parent" || (user.is_internal && user.internal_status === "inactive")) {
      return c.redirect("/oauth/login?error=Invalid+credentials");
    }
    if (!user.password_hash) {
      const message = user.google_sub
        ? "This account uses Google sign-in. Web sign-in with Google is not connected yet."
        : "This account uses Apple sign-in. Web sign-in with Apple is not connected yet.";
      return c.redirect(`/oauth/login?error=${encodeURIComponent(message)}`);
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return c.redirect("/oauth/login?error=Invalid+credentials");

    writeLoginCookie(c, await signLoginCookie({ ...session, sub: user.id }));
    return c.redirect(nextAfterLogin(c));
  });

  app.get("/consent", async (c) => {
    const session = await requireParent(c);
    if (session instanceof Response) return session;
    const { rows } = await pool.query(
      `SELECT c.id, COALESCE(NULLIF(c.nickname, ''), 'Child') AS nickname, g.label AS class_label
       FROM children c
       LEFT JOIN curriculum_grades g ON g.id = c.grade_id
       WHERE c.user_id = $1
       ORDER BY c.created_at`,
      [session.sub]
    );
    const choices =
      rows.length === 0
        ? `<p>Add a child in the Vaara app, then come back.</p>`
        : `<form method="post" action="/oauth/consent">
            ${rows
              .map(
                (row: { id: string; nickname: string; class_label: string | null }) =>
                  `<label class="choice"><input type="radio" name="child_id" value="${escapeHtml(row.id)}" required /> ${escapeHtml(row.nickname)}${row.class_label ? ` · ${escapeHtml(row.class_label)}` : ""}</label>`
              )
              .join("")}
            <label class="choice"><input type="checkbox" name="adult" value="yes" required /> I am the parent or legal guardian, and I am 18 or older.</label>
            <button type="submit">Allow JEE Prep</button>
          </form>`;
    return c.html(
      page(
        "Allow JEE Prep",
        `<h1>Allow JEE Prep</h1>
         <p>JEE Prep will receive a private id for you and the child you pick, plus the child's class. It will not receive your email.</p>
         <div class="card">${choices}</div>`
      )
    );
  });

  app.post("/consent", limit, async (c) => {
    const session = await requireParent(c);
    if (session instanceof Response) return session;
    const body = await c.req.parseBody();
    const childId = typeof body.child_id === "string" ? body.child_id : "";
    if (body.adult !== "yes" || !childId) return c.redirect("/oauth/consent");

    const child = await pool.query(
      `SELECT c.id, COALESCE(NULLIF(c.nickname, ''), 'Child') AS nickname, g.label AS class_label
       FROM children c
       LEFT JOIN curriculum_grades g ON g.id = c.grade_id
       WHERE c.id = $1 AND c.user_id = $2`,
      [childId, session.sub]
    );
    if (child.rows.length === 0) return c.redirect("/oauth/consent");

    const client = await clientAllows(session.clientId, session.redirectUri);
    if (!client) return c.text("This app is not allowed to sign in with Vaara.", 400);

    const code = randomToken();
    await pool.query(
      `INSERT INTO oauth_auth_codes (code_hash, client_id, parent_id, child_id, code_challenge, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + interval '60 seconds')`,
      [sha256(code), session.clientId, session.sub, childId, session.codeChallenge, session.redirectUri]
    );
    deleteCookie(c, oauthCookieName(), { path: "/oauth" });
    const url = new URL(session.redirectUri);
    url.searchParams.set("code", code);
    url.searchParams.set("state", session.state);
    return c.redirect(url.toString());
  });

  app.post("/token", limit, async (c) => {
    const body = await c.req.parseBody().catch(() => ({} as Record<string, string>));
    const json = Object.keys(body).length > 0 ? body : await c.req.json().catch(() => ({}));
    const record = json as Record<string, string>;
    const code = record.code ?? "";
    const verifier = record.code_verifier ?? "";
    const clientId = record.client_id ?? "";
    const redirectUri = record.redirect_uri ?? "";
    if (!code || !verifier || !clientId || !redirectUri) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT code_hash, parent_id, child_id, code_challenge, redirect_uri, expires_at, used_at
         FROM oauth_auth_codes WHERE code_hash = $1 AND client_id = $2 FOR UPDATE`,
        [sha256(code), clientId]
      );
      const authCode = rows[0] as
        | {
            parent_id: string;
            child_id: string;
            code_challenge: string;
            redirect_uri: string;
            expires_at: Date;
            used_at: Date | null;
          }
        | undefined;
      if (!authCode || authCode.used_at || authCode.redirect_uri !== redirectUri || new Date(authCode.expires_at) < new Date()) {
        await client.query("ROLLBACK");
        return c.json({ error: "invalid_grant" }, 400);
      }
      if (!pkceMatches(verifier, authCode.code_challenge)) {
        await client.query("ROLLBACK");
        return c.json({ error: "invalid_grant" }, 400);
      }
      await client.query(`UPDATE oauth_auth_codes SET used_at = now() WHERE code_hash = $1`, [sha256(code)]);
      const parentId = authCode.parent_id;
      const childId = authCode.child_id;
      await client.query("COMMIT");
      return c.json(
        await issuePrepSession({
          clientId,
          parentId,
          childId,
          deviceLabel: "JEE Prep browser",
        })
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/google", limit, async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session) return c.text("Start sign-in from JEE Prep.", 400);
    const body = await c.req.parseBody();
    const credential = typeof body.credential === "string" ? body.credential : "";
    if (!credential) return c.redirect("/oauth/login?error=Google+sign-in+failed");
    let identity;
    try {
      identity = await verifyGoogleIdToken(credential);
    } catch {
      return c.redirect("/oauth/login?error=Google+sign-in+failed");
    }
    if (!identity.emailVerified) {
      return c.redirect("/oauth/login?error=Google+email+must+be+verified");
    }
    const userId = await findOrCreateGoogleParent(identity.sub, identity.email, identity.name, session.clientId);
    if (!userId) return c.redirect("/oauth/login?error=This+account+cannot+sign+in");
    writeLoginCookie(c, await signLoginCookie({ ...session, sub: userId }));
    const childCount = await pool.query(`SELECT id FROM children WHERE user_id = $1 LIMIT 1`, [userId]);
    if (childCount.rows.length === 0) return c.redirect("/oauth/signup?google=1");
    return c.redirect(nextAfterLogin(c));
  });

  app.get("/signup", async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session) return c.text("Start sign-in from JEE Prep.", 400);
    const error = c.req.query("error");
    const google = c.req.query("google") === "1";
    const accountFields = google
      ? ""
      : `<label>Email <input type="email" name="email" required /></label>
         <label>Password <input type="password" name="password" required /></label>`;
    return c.html(
      page(
        "Create a Vaara account",
        `<h1>${google ? "Add your child" : "Create a Vaara account"}</h1>
         <p>This is enough to practice. You can finish the rest of Vaara later in the app.</p>
         ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
         <form method="post" action="/oauth/signup">
           ${accountFields}
           <label>Child's nickname <input name="nickname" required maxlength="40" /></label>
           <label>Class
             <select name="class_band" required>
               ${[6, 7, 8, 9, 10, 11, 12].map((n) => `<option>Class ${n}</option>`).join("")}
             </select>
           </label>
           <button type="submit">Continue</button>
         </form>`
      )
    );
  });

  app.post("/signup", limit, async (c) => {
    const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
    if (!session) return c.text("Start sign-in from JEE Prep.", 400);
    const body = await c.req.parseBody();
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    const classBand = typeof body.class_band === "string" ? body.class_band : "";
    const classNumber = Number(classBand.replace("Class ", ""));
    if (!nickname || nickname.length > 40 || classNumber < 6 || classNumber > 12) {
      return c.redirect("/oauth/signup?error=Enter+a+nickname+and+class");
    }

    let userId = session.sub;
    if (!userId) {
      const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
      const password = typeof body.password === "string" ? body.password : "";
      const passwordProblem = passwordError(password);
      if (!isValidEmail(email)) return c.redirect("/oauth/signup?error=Enter+a+valid+email");
      if (passwordProblem) return c.redirect(`/oauth/signup?error=${encodeURIComponent(passwordProblem)}`);
      const created = await createParentWithPassword(email, password, session.clientId);
      if ("error" in created) return c.redirect(`/oauth/signup?error=${encodeURIComponent(created.error)}`);
      userId = created.id;
    }

    const childId = await createCbseChild(userId, nickname, classNumber);
    if (!childId) return c.redirect("/oauth/signup?error=Could+not+add+the+child");
    writeLoginCookie(c, await signLoginCookie({ ...session, sub: userId }));
    return c.redirect("/oauth/consent");
  });

  return app;
}

function nextAfterLogin(c: Context): string {
  const pending = getCookie(c, "vaara_oauth_device");
  return pending ? `/oauth/device?user_code=${encodeURIComponent(pending)}` : "/oauth/consent";
}

async function findOrCreateGoogleParent(
  googleSub: string,
  email: string,
  name: string | null,
  clientId: string
): Promise<string | null> {
  const byGoogle = await pool.query(
    `SELECT id, is_internal, internal_status FROM users WHERE google_sub = $1`,
    [googleSub]
  );
  if (byGoogle.rows[0]) {
    if (byGoogle.rows[0].is_internal && byGoogle.rows[0].internal_status === "inactive") return null;
    return byGoogle.rows[0].id as string;
  }
  const byEmail = await pool.query(
    `SELECT id, google_sub, is_internal, internal_status FROM users WHERE email = $1`,
    [email]
  );
  if (byEmail.rows[0]) {
    if (byEmail.rows[0].is_internal && byEmail.rows[0].internal_status === "inactive") return null;
    if (byEmail.rows[0].google_sub && byEmail.rows[0].google_sub !== googleSub) return null;
    await pool.query(`UPDATE users SET google_sub = $2, updated_at = now() WHERE id = $1`, [
      byEmail.rows[0].id,
      googleSub,
    ]);
    return byEmail.rows[0].id as string;
  }
  const handle = await uniqueHandle();
  const avatarKey = defaultAvatarKeyForHandle(handle);
  const displayName = normalizeDisplayName(name);
  const inserted = await pool.query(
    `INSERT INTO users (email, role, display_name, anonymous_handle, google_sub, avatar_key, origin_client, onboarding_complete)
     VALUES ($1, 'parent', $2, $3, $4, $5, $6, false)
     RETURNING id`,
    [email, displayName, handle, googleSub, avatarKey, clientId]
  );
  return inserted.rows[0].id as string;
}

async function createParentWithPassword(
  email: string,
  password: string,
  clientId: string
): Promise<{ id: string } | { error: string }> {
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length > 0) return { error: "Email already registered. Sign in instead." };
  const handle = await uniqueHandle();
  const avatarKey = defaultAvatarKeyForHandle(handle);
  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await pool.query(
    `INSERT INTO users (email, password_hash, role, anonymous_handle, avatar_key, origin_client, onboarding_complete)
     VALUES ($1, $2, 'parent', $3, $4, $5, false)
     RETURNING id`,
    [email, passwordHash, handle, avatarKey, clientId]
  );
  return { id: inserted.rows[0].id as string };
}

async function createCbseChild(userId: string, nickname: string, classNumber: number): Promise<string | null> {
  const grade = await pool.query(
    `SELECT g.id, g.curriculum_id
     FROM curriculum_grades g
     JOIN curricula c ON c.id = g.curriculum_id
     WHERE c.code = 'CBSE' AND g.code = $1`,
    [`G${classNumber}`]
  );
  if (!grade.rows[0]) return null;
  const inserted = await pool.query(
    `INSERT INTO children (user_id, nickname, curriculum_id, grade_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, nickname, grade.rows[0].curriculum_id, grade.rows[0].id]
  );
  return inserted.rows[0].id as string;
}

async function uniqueHandle(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const handle = generateAnonymousHandle();
    const clash = await pool.query(`SELECT id FROM users WHERE anonymous_handle = $1`, [handle]);
    if (clash.rows.length === 0) return handle;
  }
  return generateAnonymousHandle();
}

async function requireParent(c: Context): Promise<(OauthLoginClaims & { sub: string }) | Response> {
  const session = await readLoginCookie(getCookie(c, oauthCookieName()) ?? "");
  if (!session?.sub) return c.html(page("Sign in", `<p>Sign in again from JEE Prep.</p>`));
  return { ...session, sub: session.sub };
}

