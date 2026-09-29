import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), "../../.env.local") });

import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { areaKey } from "../src/lib/areas/normalize.js";
import { areaCityForStoredLocation } from "../src/lib/areas/parent-city.js";
import { resolveCanonicalArea } from "../src/lib/areas/resolve.js";
import { syncCircleMembership } from "../src/services/circle-sync.js";

type ParentRow = {
  user_id: string;
  country_code: string | null;
  pin_code: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  area_id: string | null;
};

type Plan = {
  userId: string;
  pin: string | null;
  locality: string;
  storedCity: string;
  outcome: "existing" | "provisional" | "skipped";
  areaId: string | null;
  areaName: string;
  areaCity: string;
  areaState: string;
  destinationKey: string;
};

const APPLY = process.argv.includes("--apply");

function destinationCircleKey(sourceKey: string, areaId: string): string | null {
  if (sourceKey.startsWith("PIN_")) return `AREA_${areaId}`;
  const age = sourceKey.match(/^AGE_POSTAL_[A-Z]+_\d+_(Y\d+)$/);
  if (age) return `AGE_AREA_${areaId}_${age[1]}`;
  return null;
}

async function planParent(client: PoolClient, row: ParentRow): Promise<Plan> {
  const locality = row.locality?.trim() ?? "";
  const storedCity = row.city?.trim() ?? "";
  const base = {
    userId: row.user_id,
    pin: row.pin_code,
    locality,
    storedCity,
    areaId: null as string | null,
    areaName: locality,
    areaCity: storedCity,
    areaState: row.state?.trim() || storedCity,
    destinationKey: "",
  };
  if (!locality || !storedCity) {
    return { ...base, outcome: "skipped" };
  }

  const cityChoice = areaCityForStoredLocation(locality, storedCity);
  const areaCity = cityChoice.city;
  const areaState = cityChoice.hyderabadOverride
    ? "Telangana"
    : row.state?.trim() || areaCity;
  const country = (row.country_code ?? "IN").trim().toUpperCase() || "IN";
  const resolved = await resolveCanonicalArea(client, {
    countryCode: country,
    city: areaCity,
    state: areaState,
    areaName: locality,
    postalCode: row.pin_code,
    createIfMissing: false,
  });
  if (resolved) {
    return {
      ...base,
      outcome: "existing",
      areaId: resolved.id,
      areaName: resolved.canonicalName,
      areaCity: resolved.city,
      areaState: resolved.state,
      destinationKey: `${resolved.city} · ${resolved.canonicalName}`,
    };
  }
  return {
    ...base,
    outcome: "provisional",
    areaName: locality,
    areaCity,
    areaState,
    destinationKey: areaKey(country, areaCity, locality),
  };
}

function printReport(plans: Plan[], extras: {
  messages: Array<{ id: string; authorId: string; circleKey: string; destination: string }>;
  posts: Array<{ id: string; authorId: string; circleKey: string; destination: string }>;
  splits: Array<{ pin: string; areas: string; members: number }>;
  unmappedListings: string[];
  unmappedActivityPins: string[];
  unmappedProviderPins: string[];
}) {
  const existing = plans.filter((plan) => plan.outcome === "existing").length;
  const provisional = plans.filter((plan) => plan.outcome === "provisional").length;
  const skipped = plans.filter((plan) => plan.outcome === "skipped").length;
  const destinations = new Map<string, number>();
  for (const plan of plans) {
    if (plan.outcome === "skipped") continue;
    destinations.set(
      plan.destinationKey,
      (destinations.get(plan.destinationKey) ?? 0) + 1
    );
  }
  const ranked = [...destinations.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  console.log("PIN → area dry run");
  console.log(`parents resolved to an existing area: ${existing}`);
  console.log(`parents given a new provisional area: ${provisional}`);
  console.log(`parents skipped because locality or city is blank: ${skipped}`);
  console.log(`destination areas: ${ranked.length}`);
  for (const [name, count] of ranked) {
    console.log(`  ${count}\t${name}`);
  }
  console.log(`PIN circles that split into more than one area: ${extras.splits.length}`);
  for (const split of extras.splits) {
    console.log(`  PIN_${split.pin} (${split.members}) → ${split.areas}`);
  }
  console.log(`messages: ${extras.messages.length}`);
  for (const message of extras.messages) {
    console.log(`  ${message.circleKey} author ${message.authorId} → ${message.destination}`);
  }
  console.log(`posts: ${extras.posts.length}`);
  for (const post of extras.posts) {
    console.log(`  ${post.circleKey} author ${post.authorId} → ${post.destination}`);
  }
  console.log(`listings that could not be mapped: ${extras.unmappedListings.length}`);
  for (const id of extras.unmappedListings) console.log(`  listing ${id}`);
  console.log(`activity PINs that could not be mapped: ${extras.unmappedActivityPins.length}`);
  for (const pin of extras.unmappedActivityPins) console.log(`  activity pin ${pin}`);
  console.log(`provider PINs that could not be mapped: ${extras.unmappedProviderPins.length}`);
  for (const pin of extras.unmappedProviderPins) console.log(`  provider pin ${pin}`);
}

async function loadMessages(
  client: PoolClient,
  byUser: Map<string, Plan>
) {
  const { rows } = await client.query<{
    id: string;
    author_id: string;
    key: string;
  }>(
    `SELECT m.id, m.author_id, c.key
     FROM circle_messages m
     JOIN circles c ON c.id = m.circle_id
     WHERE c.key LIKE 'PIN_%'
        OR c.key LIKE 'AGE_POSTAL_%'`
  );
  return rows.map((row) => {
    const plan = byUser.get(row.author_id);
    return {
      id: row.id,
      authorId: row.author_id,
      circleKey: row.key,
      destination: plan && plan.outcome !== "skipped" ? plan.destinationKey : "unmapped",
    };
  });
}

async function loadPosts(client: PoolClient, byUser: Map<string, Plan>) {
  const { rows } = await client.query<{
    id: string;
    author_id: string;
    key: string;
  }>(
    `SELECT DISTINCT p.id, p.author_id, c.key
     FROM circle_posts p
     JOIN circle_post_targets t ON t.post_id = p.id
     JOIN circles c ON c.id = t.circle_id
     WHERE c.key LIKE 'PIN_%'
        OR c.key LIKE 'AGE_POSTAL_%'`
  );
  return rows.map((row) => {
    const plan = byUser.get(row.author_id);
    return {
      id: row.id,
      authorId: row.author_id,
      circleKey: row.key,
      destination: plan && plan.outcome !== "skipped" ? plan.destinationKey : "unmapped",
    };
  });
}

async function ensureCircle(
  client: PoolClient,
  key: string,
  circleType: "locality" | "age_locality",
  displayName: string,
  metadata: Record<string, unknown>
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO circles (circle_type, key, display_name, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET display_name = circles.display_name
     RETURNING id`,
    [circleType, key, displayName, JSON.stringify(metadata)]
  );
  return rows[0]?.id ?? null;
}

async function moveAuthorContent(
  client: PoolClient,
  userId: string,
  areaId: string,
  areaName: string,
  areaCity: string
) {
  const messages = await client.query<{
    id: string;
    circle_id: string;
    seq: string;
    thread_id: string | null;
    key: string;
  }>(
    `SELECT m.id, m.circle_id, m.seq, m.thread_id, c.key
     FROM circle_messages m
     JOIN circles c ON c.id = m.circle_id
     WHERE m.author_id = $1
       AND (c.key LIKE 'PIN_%' OR c.key LIKE 'AGE_POSTAL_%')
     ORDER BY m.seq`,
    [userId]
  );

  for (const message of messages.rows) {
    if (message.thread_id) {
      throw new Error(`Message ${message.id} is in a thread and was not moved`);
    }
    const destKey = destinationCircleKey(message.key, areaId);
    if (!destKey) continue;
    const destId = await ensureCircle(
      client,
      destKey,
      destKey.startsWith("AGE_AREA_") ? "age_locality" : "locality",
      destKey.startsWith("AGE_AREA_") ? areaName : `${areaName}, ${areaCity}`,
      { area_id: areaId, locality: areaName, city: areaCity }
    );
    if (!destId) continue;
    const next = await client.query<{ seq: string }>(
      `SELECT (COALESCE(MAX(seq), 0) + 1)::text AS seq
       FROM circle_messages WHERE circle_id = $1`,
      [destId]
    );
    const newSeq = next.rows[0]?.seq ?? "1";
    await client.query(
      `UPDATE circle_messages SET circle_id = $2, seq = $3 WHERE id = $1`,
      [message.id, destId, newSeq]
    );
    await client.query(
      `INSERT INTO circle_chat_reads (
         circle_id, user_id, last_read_message_seq, last_seen_thread_seq, last_read_at
       )
       SELECT $1, r.user_id, $2, r.last_seen_thread_seq, r.last_read_at
       FROM circle_chat_reads r
       WHERE r.circle_id = $3
         AND r.last_read_message_seq >= $4
         AND r.user_id IN (SELECT user_id FROM circle_members WHERE circle_id = $1)
       ON CONFLICT (circle_id, user_id) DO UPDATE SET
         last_read_message_seq = GREATEST(
           COALESCE(circle_chat_reads.last_read_message_seq, 0),
           EXCLUDED.last_read_message_seq
         )`,
      [destId, newSeq, message.circle_id, message.seq]
    );
  }

  const posts = await client.query<{ post_id: string; circle_id: string; key: string }>(
    `SELECT t.post_id, t.circle_id, c.key
     FROM circle_post_targets t
     JOIN circle_posts p ON p.id = t.post_id
     JOIN circles c ON c.id = t.circle_id
     WHERE p.author_id = $1
       AND (c.key LIKE 'PIN_%' OR c.key LIKE 'AGE_POSTAL_%')`,
    [userId]
  );
  for (const post of posts.rows) {
    const destKey = destinationCircleKey(post.key, areaId);
    if (!destKey) continue;
    const destId = await ensureCircle(
      client,
      destKey,
      destKey.startsWith("AGE_AREA_") ? "age_locality" : "locality",
      destKey.startsWith("AGE_AREA_") ? areaName : `${areaName}, ${areaCity}`,
      { area_id: areaId, locality: areaName, city: areaCity }
    );
    if (!destId || destId === post.circle_id) continue;
    await client.query(
      `DELETE FROM circle_post_targets a
       USING circle_post_targets b
       WHERE a.post_id = $1 AND a.circle_id = $2
         AND b.post_id = $1 AND b.circle_id = $3`,
      [post.post_id, post.circle_id, destId]
    );
    await client.query(
      `UPDATE circle_post_targets SET circle_id = $2
       WHERE post_id = $1 AND circle_id = $3`,
      [post.post_id, destId, post.circle_id]
    );
    await client.query(
      `UPDATE circle_posts SET circle_id = $2 WHERE id = $1 AND circle_id = $3`,
      [post.post_id, destId, post.circle_id]
    );
  }
}

async function applyPlans(plans: Plan[]) {
  const movable = plans.filter((plan) => plan.outcome !== "skipped");
  const batchSize = 25;
  for (let offset = 0; offset < movable.length; offset += batchSize) {
    const batch = movable.slice(offset, offset + batchSize);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const plan of batch) {
        const row = await client.query<ParentRow>(
          `SELECT user_id, country_code, pin_code, locality, city, state, area_id
           FROM user_locations WHERE user_id = $1`,
          [plan.userId]
        );
        const current = row.rows[0];
        if (!current) continue;
        const resolved = await resolveCanonicalArea(client, {
          countryCode: (current.country_code ?? "IN").trim().toUpperCase() || "IN",
          city: plan.areaCity,
          state: plan.areaState,
          areaName: plan.locality,
          postalCode: current.pin_code,
          createIfMissing: true,
        });
        if (!resolved) continue;
        await client.query(
          `UPDATE user_locations SET area_id = $2, updated_at = now() WHERE user_id = $1`,
          [plan.userId, resolved.id]
        );
        await syncCircleMembership(client, plan.userId);
        await moveAuthorContent(
          client,
          plan.userId,
          resolved.id,
          resolved.canonicalName,
          resolved.city
        );
      }
      await client.query("COMMIT");
      console.log(`applied parents ${offset + 1}-${offset + batch.length}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const archived = await client.query(
      `UPDATE circles c
       SET archived_at = now()
       WHERE c.archived_at IS NULL
         AND (c.key LIKE 'PIN_%' OR c.key LIKE 'AGE_POSTAL_%')
         AND NOT EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM circle_messages m WHERE m.circle_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM circle_posts p WHERE p.circle_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM circle_post_targets t WHERE t.circle_id = c.id)
       RETURNING c.key`
    );
    await client.query(
      `UPDATE listings l
       SET area_id = ul.area_id, updated_at = now()
       FROM user_locations ul
       WHERE ul.user_id = l.seller_id
         AND ul.area_id IS NOT NULL
         AND l.area_id IS NULL`
    );
    await client.query(
      `INSERT INTO activity_areas (activity_id, area_id)
       SELECT DISTINCT apc.activity_id, ul.area_id
       FROM activity_pin_codes apc
       JOIN user_locations ul
         ON ul.pin_code = apc.pin_code AND ul.area_id IS NOT NULL
       ON CONFLICT DO NOTHING`
    );
    await client.query(
      `INSERT INTO provider_service_areas (provider_id, area_id)
       SELECT DISTINCT p.user_id, ul.area_id
       FROM providers p
       CROSS JOIN LATERAL unnest(p.service_pin_codes) AS pin(code)
       JOIN user_locations ul
         ON ul.pin_code = pin.code AND ul.area_id IS NOT NULL
       ON CONFLICT DO NOTHING`
    );
    await client.query("COMMIT");
    console.log(`archived empty PIN circles: ${archived.rowCount ?? 0}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const parents = await client.query<ParentRow>(
      `SELECT ul.user_id, ul.country_code, ul.pin_code, ul.locality, ul.city, ul.state, ul.area_id
       FROM user_locations ul
       JOIN user_roles ur ON ur.user_id = ul.user_id AND ur.role = 'parent'`
    );
    const plans: Plan[] = [];
    for (const row of parents.rows) {
      plans.push(await planParent(client, row));
    }
    const byUser = new Map(plans.map((plan) => [plan.userId, plan]));
    const byPin = new Map<string, Map<string, number>>();
    for (const plan of plans) {
      if (!plan.pin || plan.outcome === "skipped") continue;
      const areas = byPin.get(plan.pin) ?? new Map<string, number>();
      areas.set(plan.destinationKey, (areas.get(plan.destinationKey) ?? 0) + 1);
      byPin.set(plan.pin, areas);
    }
    const splits = [...byPin.entries()]
      .filter(([, areas]) => areas.size > 1)
      .map(([pin, areas]) => ({
        pin,
        members: [...areas.values()].reduce((sum, count) => sum + count, 0),
        areas: [...areas.entries()].map(([name, count]) => `${name} (${count})`).join("; "),
      }));

    const resolvedPins = new Set(
      plans.filter((plan) => plan.outcome !== "skipped" && plan.pin).map((plan) => plan.pin as string)
    );
    const listings = await client.query<{ id: string; seller_id: string }>(
      `SELECT id, seller_id FROM listings`
    );
    const unmappedListings = listings.rows
      .filter((row) => {
        const plan = byUser.get(row.seller_id);
        return !plan || plan.outcome === "skipped";
      })
      .map((row) => row.id);

    const activityPins = await client.query<{ pin_code: string }>(
      `SELECT DISTINCT pin_code FROM activity_pin_codes`
    );
    const unmappedActivityPins = activityPins.rows
      .map((row) => row.pin_code)
      .filter((pin) => !resolvedPins.has(pin));

    const providers = await client.query<{ code: string }>(
      `SELECT DISTINCT pin.code
       FROM providers p
       CROSS JOIN LATERAL unnest(p.service_pin_codes) AS pin(code)`
    );
    const unmappedProviderPins = providers.rows
      .map((row) => row.code)
      .filter((pin) => !resolvedPins.has(pin));

    const messages = await loadMessages(client, byUser);
    const posts = await loadPosts(client, byUser);
    printReport(plans, {
      messages,
      posts,
      splits,
      unmappedListings,
      unmappedActivityPins,
      unmappedProviderPins,
    });
    if (!APPLY) {
      console.log("dry run only — no rows were written");
      return;
    }
  } finally {
    client.release();
  }

  if (APPLY) {
    const client = await pool.connect();
    let plans: Plan[] = [];
    try {
      const parents = await client.query<ParentRow>(
        `SELECT ul.user_id, ul.country_code, ul.pin_code, ul.locality, ul.city, ul.state, ul.area_id
         FROM user_locations ul
         JOIN user_roles ur ON ur.user_id = ul.user_id AND ur.role = 'parent'`
      );
      for (const row of parents.rows) plans.push(await planParent(client, row));
    } finally {
      client.release();
    }
    await applyPlans(plans);
    console.log("apply finished");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
