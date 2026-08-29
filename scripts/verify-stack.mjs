// Ad-hoc production verification: Redis, S3 presign + CloudFront read, realtime WS.
import { config } from "dotenv";
import { resolve } from "path";
import { Redis } from "ioredis";
import { SignJWT } from "jose";
import WebSocket from "ws";

config({ path: resolve(process.cwd(), ".env.local") });

const API = process.env.EXPO_PUBLIC_API_URL;
const WS_URL = process.env.EXPO_PUBLIC_REALTIME_URL;
const CDN = process.env.CDN_BASE_URL;

const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64"
);

async function checkRedis() {
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    connectTimeout: 8000,
    tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
  });
  redis.on("error", () => {});
  try {
    const pong = await redis.ping();
    const key = `verify:${Date.now()}`;
    await redis.set(key, "1", "EX", 30);
    const got = await redis.get(key);
    await redis.del(key);
    // pub/sub round trip
    const sub = redis.duplicate();
    sub.on("error", () => {});
    const received = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("pubsub timeout")), 8000);
      sub.on("message", (_c, m) => {
        clearTimeout(t);
        res(m);
      });
    });
    await sub.subscribe("verify:channel");
    await redis.publish("verify:channel", "hello");
    const msg = await received;
    await sub.quit();
    log("Upstash Redis: PING/SET/GET", pong === "PONG" && got === "1");
    log("Upstash Redis: pub/sub round trip", msg === "hello");
  } catch (error) {
    log("Upstash Redis", false, error.message);
  } finally {
    redis.disconnect();
  }
}

async function mintToken() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ email: "verify@vaara.ai", role: "parent" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-0000-0000-0000000000ff")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

async function checkApiHealth() {
  const res = await fetch(`${API}/health`);
  const body = await res.json();
  log(`API ${API}/health`, res.ok && body.redis === true, JSON.stringify(body));
}

async function checkMedia(token) {
  const statusRes = await fetch(`${API}/v1/media/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = await statusRes.json();
  log("API media status (Vercel AWS env)", status.configured === true, JSON.stringify(status));
  if (!status.configured) return;

  const presignRes = await fetch(`${API}/v1/media/upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: "verify.png",
      mediaType: "image",
      mimeType: "image/png",
      sizeBytes: PNG.length,
    }),
  });
  const presign = await presignRes.json();
  if (!presignRes.ok || !presign.uploadUrl) {
    log("Presigned upload URL", false, JSON.stringify(presign));
    return;
  }
  log("Presigned upload URL", true, presign.storageKey);

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: PNG,
  });
  log("S3 direct upload (presigned PUT)", put.ok, `HTTP ${put.status}`);
  if (!put.ok) {
    console.log(await put.text());
    return;
  }

  // CloudFront may need a moment for the first fetch
  let cdn;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    cdn = await fetch(`${CDN}/${presign.storageKey}`);
    if (cdn.ok) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const bytes = cdn.ok ? Buffer.from(await cdn.arrayBuffer()).length : 0;
  log(
    "CloudFront read of uploaded object",
    cdn.ok && bytes === PNG.length,
    `HTTP ${cdn.status}, ${bytes} bytes, x-cache=${cdn.headers.get("x-cache")}`
  );
  log(
    "CDN URL matches API publicUrl",
    presign.publicUrl === `${CDN}/${presign.storageKey}`,
    presign.publicUrl
  );

  const direct = await fetch(
    `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${presign.storageKey}`
  );
  log("S3 blocked to public (expect 403)", direct.status === 403, `HTTP ${direct.status}`);
}

async function checkRealtime(token) {
  const res = await fetch(WS_URL.replace("wss://", "https://").replace("/ws", "/health"));
  log("Realtime /health", res.ok, JSON.stringify(await res.json()));

  await new Promise((resolveCheck) => {
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => {
      log("Realtime WS handshake", false, "timeout");
      socket.terminate();
      resolveCheck();
    }, 12000);

    socket.on("message", (raw) => {
      const payload = JSON.parse(raw.toString());
      clearTimeout(timer);
      log("Realtime WS auth + connect", payload.type === "connected", raw.toString());
      socket.close();
      resolveCheck();
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      log("Realtime WS handshake", false, error.message);
      resolveCheck();
    });
    socket.on("close", (code) => {
      if (code === 4401) log("Realtime WS auth", false, "rejected 4401");
    });
  });

  await new Promise((resolveCheck) => {
    const socket = new WebSocket(`${WS_URL}?token=bogus`);
    socket.on("close", (code) => {
      log("Realtime WS rejects bad token", code === 4401, `close ${code}`);
      resolveCheck();
    });
    socket.on("error", () => {
      log("Realtime WS rejects bad token", true, "connection refused");
      resolveCheck();
    });
  });
}

const token = await mintToken();
await checkApiHealth();
await checkRedis();
await checkMedia(token);
await checkRealtime(token);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
