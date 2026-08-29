# Deploy realtime + worker (India-friendly)

Vercel cannot run WebSockets or background workers. Use one of these hosts instead.

| Platform | Region near India | WebSockets | ISP access in India |
|----------|-------------------|------------|---------------------|
| **[Fly.io](https://fly.io)** (recommended) | **Mumbai (`bom`)** | Yes | Generally good |
| **[Render](https://render.com)** | Singapore (`sgp`) | Yes (Starter plan) | Generally good |
| **[DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)** | Bangalore (`blr`) | Yes | Generally good |

Railway is omitted here because some Indian ISPs block or throttle it.

---

## Architecture (unchanged)

```text
Phone ──WebSocket──▶ Realtime host (Fly/Render)
                         ▲
                         │ Redis pub/sub
Vercel API ──────────────┘
```

All services share the same `REDIS_URL` (Upstash) and `JWT_SECRET`.

---

## Option A — Fly.io (Mumbai)

Fly has no Mumbai region, so these apps run in **Singapore (`sin`)**, the closest
available option.

### 1. Install CLI

```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
flyctl auth login
```

### 2. Deploy

From the **repo root**. The script creates the app if needed, stages
`DATABASE_URL` / `REDIS_URL` / `JWT_SECRET` from `.env.local`, and deploys:

```bash
./scripts/deploy-fly.sh realtime
```

Two details the config handles, worth knowing if you deploy by hand:

- `flyctl deploy .` must run from the repo root, because the Docker build needs
  the whole workspace. The `dockerfile` value in `fly.toml` is resolved relative
  to `fly.toml` itself, so it is just `Dockerfile`.
- `PORT` is set to `8080` in `[env]` to match `internal_port`. Without it the
  server binds `3002` and fly-proxy health checks never pass.

### 3. Verify

```bash
curl https://vaara-realtime.fly.dev/health
# {"status":"ok","service":"realtime"}
```

Your WebSocket URL:

```text
wss://<your-app>.fly.dev/ws
```

Example: `wss://vaara-realtime.fly.dev/ws`

### 6. Mobile app

Add to `apps/mobile/eas.json` (preview/production `env`) and rebuild the APK:

```json
"EXPO_PUBLIC_REALTIME_URL": "wss://vaara-realtime.fly.dev/ws"
```

---

## Option B — Render (Singapore)

### 1. Connect repo

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect GitHub repo `vaara-ai-parents`
3. Render reads `render.yaml` and creates **vaara-realtime** + **vaara-worker**

### 2. Set env vars

In each service → **Environment**, paste:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

### 3. Deploy

Render deploys automatically. Open **vaara-realtime** → copy the public URL.

WebSocket URL:

```text
wss://vaara-realtime.onrender.com/ws
```

> Use the **Starter** plan ($7/mo per service) so the app stays always-on. Free tier sleeps and kills WebSockets.

### 4. Mobile app

```json
"EXPO_PUBLIC_REALTIME_URL": "wss://vaara-realtime.onrender.com/ws"
```

---

## Option C — DigitalOcean App Platform (Bangalore)

1. **Create App** → GitHub → select repo
2. **Component type:** Web Service
3. **Build:** `npm install && npm run build:realtime`
4. **Run:** `node apps/realtime/dist/index.js`
5. **Region:** Bangalore (`blr1`)
6. **HTTP port:** 8080 (set `PORT=8080` in env; the app reads `PORT` automatically)
7. Add `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
8. Enable **WebSocket** support in app settings

---

## Worker (push notifications / job queues) — required once Redis is on

This is not optional. As soon as `REDIS_URL` is set on the API, post and message
notifications are pushed onto BullMQ queues instead of being sent inline. With no
worker running, those jobs pile up and **no notifications are ever delivered**,
and scheduled reminders/digests stop too.

```bash
./scripts/deploy-fly.sh worker
```

Verify: `https://vaara-worker.fly.dev/health` returns `{"status":"ok","service":"worker"}`.

---

## Checklist

- [ ] `REDIS_URL` on Vercel → `/health` shows `"redis": true`
- [ ] Realtime deployed → `/health` returns `{"status":"ok","service":"realtime"}`
- [ ] **Worker deployed** → otherwise notifications and reminders stop silently
- [ ] `EXPO_PUBLIC_REALTIME_URL` set in `eas.json` → new APK built
- [ ] Post in a circle on two phones → second phone updates within ~1s
- [ ] Check Upstash command usage after a day of testing; BullMQ polling plus
      feed caching burns through free-tier request quotas faster than expected
