// Signup critical-path latency measurement.
//
// Replays the exact request waterfall the mobile app performs from cold start
// through "onboarding complete", measures per-request connection phases and
// payload sizes, then projects perceived wall-clock time onto slow-network
// profiles.
//
// Usage:
//   TEST_API_URL=https://api.vaara.ai node scripts/signup-speed-test.mjs
//   TEST_API_URL=http://localhost:3000 RUNS=5 node scripts/signup-speed-test.mjs
//
// Each run registers a throwaway user and deletes it again via DELETE /v1/me.

import { config } from "dotenv";
import { resolve } from "path";
import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";

config({ path: resolve(process.cwd(), ".env.local") });

const API = (process.env.TEST_API_URL ?? process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const RUNS = Number(process.env.RUNS ?? 3);

if (!API) {
  console.error("Set TEST_API_URL (or EXPO_PUBLIC_API_URL) to the API base URL.");
  process.exit(1);
}

const base = new URL(API);
const transport = base.protocol === "https:" ? https : http;

// The mobile client uses a fresh fetch per call with no connection reuse hints,
// but RN/OkHttp and iOS URLSession both pool sockets. Keep-alive here mirrors
// the realistic case; PHASES below still reports the one-time handshake cost.
const agent = new transport.Agent({ keepAlive: true, maxSockets: 8 });

// Access-network profiles. `extraRttMs` is latency the handset's radio adds
// *on top of* the round trip this machine already measures, so the projection
// keeps the real path to the compute region rather than replacing it.
// Throughput figures follow the usual emulator / Network Link Conditioner
// presets.
const NETWORK_PROFILES = [
  { name: "Same link as this machine", extraRttMs: 0, downKbps: 30000, upKbps: 15000 },
  { name: "Good 4G / LTE", extraRttMs: 50, downKbps: 8000, upKbps: 3000 },
  { name: "3G (HSPA)", extraRttMs: 180, downKbps: 1500, upKbps: 700 },
  { name: "2G / EDGE", extraRttMs: 480, downKbps: 250, upKbps: 150 },
];

/**
 * Issues one request, recording DNS / TCP / TLS / TTFB / download phases and
 * the on-the-wire response size.
 */
function timedRequest(method, path, { token, body } = {}) {
  return new Promise((resolvePromise, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const marks = { start: performance.now() };

    const req = transport.request(
      {
        agent,
        protocol: base.protocol,
        hostname: base.hostname,
        port: base.port || undefined,
        path: `${base.pathname.replace(/\/$/, "")}${path}`,
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept-Encoding": "gzip, br",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        marks.firstByte = performance.now();
        let raw = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          raw += chunk.length;
          chunks.push(chunk);
        });
        res.on("end", () => {
          marks.end = performance.now();
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { _nonJson: text.slice(0, 200) };
          }
          resolvePromise({
            method,
            path,
            status: res.statusCode,
            body: parsed,
            encoding: res.headers["content-encoding"] ?? "identity",
            cacheControl: res.headers["cache-control"] ?? "(none)",
            // "bom1::iad1::…" means the request entered at bom1 and executed
            // in iad1 — i.e. the function is not in the edge's region.
            vercelId: res.headers["x-vercel-id"] ?? null,
            wireBytes: raw,
            uncompressedBytes: Buffer.byteLength(text),
            requestBytes: payload ? Buffer.byteLength(payload) : 0,
            phases: {
              dns: marks.dns ? marks.dns - marks.start : 0,
              tcp: marks.tcp && marks.dns ? marks.tcp - marks.dns : 0,
              tls: marks.tls && marks.tcp ? marks.tls - marks.tcp : 0,
              ttfb: marks.firstByte - (marks.tls ?? marks.tcp ?? marks.start),
              download: marks.end - marks.firstByte,
              total: marks.end - marks.start,
            },
            reusedSocket: marks.dns === undefined,
          });
        });
      }
    );

    req.on("socket", (socket) => {
      if (socket.connecting === false) return; // pooled socket, no handshake
      socket.once("lookup", () => {
        marks.dns = performance.now();
      });
      socket.once("connect", () => {
        marks.tcp = performance.now();
      });
      socket.once("secureConnect", () => {
        marks.tls = performance.now();
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error(`${method} ${path} timed out after 30s`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function assertOk(result) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${result.method} ${result.path} -> ${result.status}: ${JSON.stringify(result.body).slice(0, 200)}`
    );
  }
  return result;
}

/**
 * A "leg" is one user-visible wait. Calls inside a leg run in parallel, so the
 * leg costs as much as its slowest call; legs themselves are sequential.
 */
async function leg(trace, label, blocking, run) {
  const started = performance.now();
  const before = trace.calls.length;
  const value = await run();
  trace.legs.push({
    label,
    blocking,
    wallMs: performance.now() - started,
    calls: trace.calls.slice(before),
  });
  return value;
}

function track(trace, promise) {
  return promise.then((result) => {
    trace.calls.push(result);
    return result;
  });
}

async function measureSignupRun(index) {
  const trace = { calls: [], legs: [] };
  const call = (...args) => track(trace, timedRequest(...args));
  const stamp = `${Date.now()}.${index}`;
  const email = `speedtest.${stamp}@vaara.test`;
  const password = `SpeedTest${stamp}!`;

  // Cold start: no token yet, so the app routes straight to /register.
  const auth = await leg(trace, "Register (POST /v1/auth/register)", true, async () =>
    assertOk(
      await call("POST", "/v1/auth/register", {
        body: { email, password, role: "parent", displayName: "Speed Test" },
      })
    )
  );
  const token = auth.body.token;

  // register.tsx -> routeAfterAuth -> resolveParentOnboardingHref
  await leg(trace, "Post-auth routing (location + children)", true, () =>
    Promise.all([call("GET", "/v1/me/location", { token }), call("GET", "/v1/me/children", { token })])
  );

  // onboarding/location.tsx mount. These are two sequential awaits in the
  // screen, not a single Promise.all — see location.tsx:85-97.
  await leg(trace, "Location mount a: postal countries", true, () =>
    call("GET", "/v1/reference/postal-countries")
  );
  await leg(trace, "Location mount b: existing location", true, () =>
    call("GET", "/v1/me/location", { token })
  );

  // Debounced postal lookup while the user types a PIN.
  await leg(trace, "Postal code lookup (debounced)", true, () =>
    call("GET", "/v1/reference/postal-codes/IN/560102", { token })
  );

  await leg(trace, "Location submit (PATCH /v1/me/location)", true, async () =>
    assertOk(
      await call("PATCH", "/v1/me/location", {
        token,
        body: { pinCode: "560102", city: "Bengaluru", state: "Karnataka", locality: "HSR Layout" },
      })
    )
  );

  // onboarding/school.tsx mount re-reads location, then the picker loads nearby.
  await leg(trace, "School screen mount (GET /v1/me/location)", true, () =>
    call("GET", "/v1/me/location", { token })
  );

  const nearby = await leg(trace, "School picker (nearby schools)", true, async () =>
    assertOk(await call("GET", "/v1/schools/nearby?city=Bengaluru&pin=560102&limit=5", { token }))
  );

  // onboarding/class.tsx mount
  const curricula = await leg(trace, "Class screen mount (curricula)", true, async () =>
    assertOk(await call("GET", "/v1/reference/curricula", { token }))
  );

  const schoolId = (Array.isArray(nearby.body) ? nearby.body : nearby.body?.schools ?? [])[0]?.id;
  const curriculum = (Array.isArray(curricula.body) ? curricula.body : curricula.body?.curricula ?? [])[0];
  const gradeId = curriculum?.grades?.[0]?.id;
  if (!schoolId || !curriculum?.id || !gradeId) {
    throw new Error("Missing school/curriculum/grade fixtures — run `npm run db:seed` against this env.");
  }

  // "Enter Vaara": create the child, then refetch the user. Sequential in the app.
  await leg(trace, "Class submit (create child, then GET /v1/me)", true, async () => {
    assertOk(
      await call("POST", "/v1/me/children", {
        token,
        body: {
          schoolId,
          curriculumId: curriculum.id,
          gradeId,
          gender: "unspecified",
          nickname: "Speed",
        },
      })
    );
    return assertOk(await call("GET", "/v1/me", { token }));
  });

  await leg(trace, "Ready screen (circles + me)", true, () =>
    Promise.all([call("GET", "/v1/circles", { token }), call("GET", "/v1/me", { token })])
  );

  // First feed load: five parallel calls, then the feed page itself.
  await leg(trace, "Feed prefetch burst (5 parallel)", true, () =>
    Promise.all([
      call("GET", "/v1/me", { token }),
      call("GET", "/v1/circles", { token }),
      call("GET", "/v1/me/children", { token }),
      call("GET", "/v1/me/notifications", { token }),
      call("GET", "/v1/me/saved", { token }),
    ])
  );

  await leg(trace, "Feed page (GET /v1/me/feed)", true, () =>
    call("GET", "/v1/me/feed?limit=20", { token })
  );

  await timedRequest("DELETE", "/v1/me", { token }).catch(() => {});

  return trace;
}

// ---------------------------------------------------------------------------
// Network projection
// ---------------------------------------------------------------------------

/**
 * Server processing time, isolated from transport.
 *
 * `floorRttMs` must be the fastest TTFB observed across the whole run, not the
 * TCP connect time. TCP terminates at the CDN edge, whereas TTFB includes the
 * edge -> function hop; using the connect time would misattribute that hop to
 * server work. The fastest endpoint therefore acts as the transport floor and
 * everything above it is real server cost.
 */
function serverTimeMs(callResult, floorRttMs) {
  return Math.max(0, callResult.phases.ttfb - floorRttMs);
}

function transferMs(bytes, kbps) {
  return (bytes * 8) / (kbps * 1000) * 1000;
}

/**
 * Projected duration of one blocking leg.
 *
 * Latency and server work overlap across parallel calls, so a leg costs as
 * much as its slowest call. Bytes, however, contend for the same radio link,
 * so transfer time adds up across the leg.
 *
 * `floorRttMs` is added back in because it represents the measured round trip
 * to the compute region — real latency that the profile's `extraRttMs` sits on
 * top of, not something to be modelled away.
 */
function projectLeg(legResult, profile, floorRttMs) {
  const latency = Math.max(
    0,
    ...legResult.calls.map((c) => profile.extraRttMs + floorRttMs + serverTimeMs(c, floorRttMs))
  );
  const transfer = legResult.calls.reduce(
    (sum, c) =>
      sum +
      transferMs(c.requestBytes, profile.upKbps) +
      transferMs(c.wireBytes, profile.downKbps),
    0
  );
  return latency + transfer;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

const ms = (n) => `${n.toFixed(0)}ms`;
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const pad = (s, n) => String(s).padEnd(n);
const padLeft = (s, n) => String(s).padStart(n);

function report(traces) {
  const allCalls = traces.flatMap((t) => t.calls);
  // Transport floor: the fastest complete round trip we ever saw.
  const floorRttMs = Math.min(...allCalls.map((c) => c.phases.ttfb));
  // Edge floor: fastest TCP handshake, which terminates at the CDN edge.
  const connects = allCalls.filter((c) => c.phases.tcp > 0).map((c) => c.phases.tcp);
  const edgeRttMs = connects.length > 0 ? Math.min(...connects) : null;
  const handshake = allCalls.find((c) => !c.reusedSocket);

  console.log(`\nSignup speed test — ${API}`);
  console.log(`${traces.length} run(s) · ${allCalls.length} requests`);
  console.log(`Transport floor (fastest TTFB): ${ms(floorRttMs)}`);
  if (handshake) {
    console.log(
      `Cold connection: DNS ${ms(handshake.phases.dns)} + TCP ${ms(handshake.phases.tcp)} + TLS ${ms(handshake.phases.tls)}` +
        ` · first-invocation TTFB ${ms(handshake.phases.ttfb)}`
    );
  }

  // If the transport floor sits far above the edge handshake, the compute is
  // not in the region the user connects to. That gap is pure geography and is
  // paid on every request, so surface it before anything else.
  if (edgeRttMs !== null) {
    const originHop = floorRttMs - edgeRttMs;
    console.log(`Client -> CDN edge (TCP): ${ms(edgeRttMs)} · edge -> compute -> edge: ~${ms(originHop)}`);
    if (originHop > 80) {
      const vercelId = allCalls.find((c) => c.vercelId)?.vercelId;
      console.log(
        `\n  WARNING: ~${ms(originHop)} of every request is spent getting to the compute region` +
          ` and back.\n  That is ${(originHop / floorRttMs * 100).toFixed(0)}% of the fastest possible response,` +
          ` paid on all ${traces[0].legs.length} sequential legs.`
      );
      if (vercelId) {
        const [entry, exec] = vercelId.split("::");
        console.log(`  x-vercel-id: entered at ${entry}, executed in ${exec}. Pin the function region.`);
      }
    }
  }

  // --- Per-leg measured wall time -----------------------------------------
  console.log(`\n${pad("BLOCKING LEG", 46)}${padLeft("p50", 9)}${padLeft("p95", 9)}${padLeft("calls", 7)}${padLeft("down", 9)}`);
  console.log("-".repeat(80));
  const legLabels = traces[0].legs.map((l) => l.label);
  for (const label of legLabels) {
    const instances = traces.flatMap((t) => t.legs.filter((l) => l.label === label));
    const wall = instances.map((l) => l.wallMs);
    const bytes = instances[0].calls.reduce((sum, c) => sum + c.wireBytes, 0);
    console.log(
      pad(label, 46) +
        padLeft(ms(percentile(wall, 50)), 9) +
        padLeft(ms(percentile(wall, 95)), 9) +
        padLeft(instances[0].calls.length, 7) +
        padLeft(kb(bytes), 9)
    );
  }
  const totals = traces.map((t) => t.legs.reduce((sum, l) => sum + l.wallMs, 0));
  console.log("-".repeat(80));
  console.log(pad("TOTAL blocking time on test network", 46) + padLeft(ms(percentile(totals, 50)), 9) + padLeft(ms(percentile(totals, 95)), 9));

  // --- Server processing time, transport removed ---------------------------
  console.log(`\n${pad("SERVER TIME BY ENDPOINT (TTFB - RTT)", 52)}${padLeft("p50", 9)}${padLeft("p95", 9)}${padLeft("wire", 9)}`);
  console.log("-".repeat(80));
  const byEndpoint = new Map();
  for (const c of allCalls) {
    const key = `${c.method} ${c.path.split("?")[0]}`;
    if (!byEndpoint.has(key)) byEndpoint.set(key, []);
    byEndpoint.get(key).push(c);
  }
  const endpointRows = [...byEndpoint.entries()]
    .map(([key, calls]) => ({
      key,
      p50: percentile(calls.map((c) => serverTimeMs(c, floorRttMs)), 50),
      p95: percentile(calls.map((c) => serverTimeMs(c, floorRttMs)), 95),
      wire: percentile(calls.map((c) => c.wireBytes), 50),
      encoding: calls[0].encoding,
    }))
    .sort((a, b) => b.p50 - a.p50);
  for (const row of endpointRows) {
    console.log(pad(row.key, 52) + padLeft(ms(row.p50), 9) + padLeft(ms(row.p95), 9) + padLeft(kb(row.wire), 9));
  }

  const uncompressed = allCalls.filter((c) => c.encoding === "identity" && c.uncompressedBytes > 2048);
  if (uncompressed.length > 0) {
    const names = [...new Set(uncompressed.map((c) => c.path.split("?")[0]))];
    console.log(`\nNOT COMPRESSED (>2KB, Content-Encoding: identity): ${names.join(", ")}`);
  }

  // Static reference data refetched on every screen mount is pure waste on a
  // metered or slow link if the edge is not allowed to cache it.
  const uncacheable = [
    ...new Set(
      allCalls
        .filter((c) => c.path.startsWith("/v1/reference/") && /max-age=0|no-store|must-revalidate/.test(c.cacheControl))
        .map((c) => `${c.path.split("?")[0]} (${c.cacheControl})`)
    ),
  ];
  if (uncacheable.length > 0) {
    console.log(`\nSTATIC DATA THE EDGE CANNOT CACHE:`);
    for (const entry of uncacheable) console.log(`  ${entry}`);
  }

  // Repeated identical GETs inside one signup are removable round trips.
  const repeats = new Map();
  for (const c of traces[0].calls) {
    if (c.method !== "GET") continue;
    const key = c.path.split("?")[0];
    repeats.set(key, (repeats.get(key) ?? 0) + 1);
  }
  const dupes = [...repeats.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  if (dupes.length > 0) {
    const wasted = dupes.reduce((sum, [, n]) => sum + n - 1, 0);
    console.log(`\nDUPLICATE GETs IN ONE SIGNUP (${wasted} removable round trips):`);
    for (const [path, n] of dupes) console.log(`  ${n}x  ${path}`);
  }

  // --- Projection onto slower access networks ------------------------------
  const run = traces[0];
  console.log(
    `\n${pad("PROJECTED SIGNUP TIME BY ACCESS NETWORK", 42)}${padLeft("total", 10)}${padLeft("latency", 10)}${padLeft("transfer", 10)}`
  );
  console.log("-".repeat(80));
  for (const profile of NETWORK_PROFILES) {
    // TLS handshake round trips terminate at the CDN edge, so they scale with
    // the edge RTT rather than the full path to the compute region.
    const handshakeRtt = (edgeRttMs ?? floorRttMs) + profile.extraRttMs;
    const cold = handshakeRtt * 3; // ~1 RTT for TCP, ~2 for TLS 1.2
    const total = run.legs.reduce((sum, l) => sum + projectLeg(l, profile, floorRttMs), 0) + cold;
    const transfer = run.calls.reduce(
      (sum, c) =>
        sum + transferMs(c.requestBytes, profile.upKbps) + transferMs(c.wireBytes, profile.downKbps),
      0
    );
    console.log(
      pad(profile.name, 42) +
        padLeft(`${(total / 1000).toFixed(1)}s`, 10) +
        padLeft(`${((total - transfer) / 1000).toFixed(1)}s`, 10) +
        padLeft(`${(transfer / 1000).toFixed(1)}s`, 10)
    );
  }
  console.log(
    `\n${run.legs.length} sequential blocking legs · ${run.calls.length} requests · ` +
      `${kb(run.calls.reduce((s, c) => s + c.wireBytes, 0))} down`
  );
  console.log(
    "Model: per leg = measured round trip + this profile's extra radio latency +\n" +
      "server time, plus one cold handshake. Parallel calls in a leg share its\n" +
      "latency but not its bandwidth. Slow start, packet loss and client render time\n" +
      "are not modelled, so these are floors. Confirm on-device with the iOS Network\n" +
      "Link Conditioner or the Android emulator's network profile."
  );
}

const traces = [];
for (let i = 0; i < RUNS; i += 1) {
  try {
    traces.push(await measureSignupRun(i));
    process.stdout.write(`run ${i + 1}/${RUNS} ok\n`);
  } catch (error) {
    console.error(`run ${i + 1}/${RUNS} failed: ${error.message}`);
  }
}

if (traces.length === 0) {
  console.error("\nNo successful runs.");
  process.exit(1);
}

report(traces);
agent.destroy();
