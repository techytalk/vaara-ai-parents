# Redis (production)

Redis powers feed caching, rate limiting, background job queues (BullMQ), and realtime pub/sub.

| Service | Needs Redis? | What it uses Redis for |
|---------|--------------|------------------------|
| **API** (`apps/api` on Vercel) | Yes (recommended) | Feed cache, rate limits, enqueue jobs, publish events |
| **Worker** (`apps/worker`) | **Required** | Process notification + maintenance jobs |
| **Realtime** (`apps/realtime`) | **Required** | WebSocket pub/sub for live feeds and DMs |

Without `REDIS_URL`, the API still works but `/health` returns `"redis": false` and notifications run inline (slower, no queues).

---

## 1. Provision Upstash Redis

Use **[Upstash](https://upstash.com)** — serverless Redis that works with Vercel, BullMQ, and ioredis.

1. Sign in at [console.upstash.com](https://console.upstash.com)
2. **Create database** — pick a region close to Neon + Vercel (e.g. `us-east-1` or `ap-south-1`)
3. Open the database → **Connect** → copy the **TCP** URL (`rediss://default:...@....upstash.io:6379`)

Use the **TCP** endpoint, not the REST URL. BullMQ and ioredis require TCP.

**Easier via Vercel:** [Vercel Marketplace → Upstash Redis](https://vercel.com/integrations/upstash) — links an Upstash database and injects `REDIS_URL` into your project automatically.

---

## 2. Configure Vercel API

In the [Vercel project](https://vercel.com) for `vaara-ai-parents`:

| Variable | Value |
|----------|--------|
| `REDIS_URL` | `rediss://default:...@....upstash.io:6379` |

Redeploy, then verify:

```bash
curl https://api.vaara.ai/health
# {"status":"ok","redis":true}
```

---

## 3. Local development (same Upstash instance)

Point your local `.env.local` at the **same** Upstash `REDIS_URL`. No separate local Redis needed — one managed instance serves dev and production (use a separate Upstash database per environment if you prefer isolation).

```env
REDIS_URL=rediss://default:...@....upstash.io:6379
```

```bash
npm run dev:api
npm run dev:worker      # separate terminal
npm run dev:realtime    # separate terminal
```

```bash
curl http://localhost:3000/health
# {"status":"ok","redis":true}
```

---

## 4. Deploy worker + realtime

Vercel serverless cannot run long-lived workers or WebSockets. Deploy to **Fly.io (Mumbai)**, **Render (Singapore)**, or **DigitalOcean (Bangalore)** — see **[docs/DEPLOY_REALTIME.md](./DEPLOY_REALTIME.md)**.

Quick reference:

| App | Build | Start |
|-----|-------|-------|
| Realtime | `npm run build:realtime` | `node apps/realtime/dist/index.js` |
| Worker | `npm run build:worker` | `node apps/worker/dist/index.js` |

Required env on both: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`.

Then set on mobile (`eas.json`):

```env
EXPO_PUBLIC_REALTIME_URL=wss://your-realtime-host/ws
```

---

## What Redis is used for

- **Feed cache** — circle/topic feeds (TTL: `FEED_CACHE_TTL_SECONDS`, default 120s)
- **Rate limiting** — post and message creation
- **Queues** — `posts`, `messages`, `listings`, `maintenance` (reminders, digests, listing expiry)
- **Pub/sub** — channels `circle:{id}`, `conversation:{id}`, `topic:{slug}` for live updates
