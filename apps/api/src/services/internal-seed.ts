import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { generateAnonymousHandle } from "../lib/anonymity.js";
import { defaultAvatarKeyForHandle } from "../lib/avatar.js";
import { syncCircleMembership } from "./circle-sync.js";
import {
  createCircleMessage,
  createThread,
  publishChatNudge,
} from "./chat.js";

export type SeedRole = "asker" | "responder";
export type SeedTarget = "school" | "curriculum" | "school_class";

export type SeedUserView = {
  id: string;
  email: string;
  displayName: string | null;
  anonymousHandle: string;
  internalKind: string | null;
  internalStatus: string;
  internalSpawnKey: string | null;
  onboardingComplete: boolean;
  createdIst: string | null;
};

type SchoolRow = {
  id: string;
  name: string;
  branch: string | null;
  city: string | null;
  state: string | null;
  locality: string | null;
  pin_code: string | null;
  normalized_key: string;
};

async function uniqueHandle(client: PoolClient): Promise<string> {
  let handle = generateAnonymousHandle();
  for (let attempt = 0; attempt < 8; attempt++) {
    const clash = await client.query(
      "SELECT id FROM users WHERE anonymous_handle = $1",
      [handle]
    );
    if (clash.rows.length === 0) return handle;
    handle = generateAnonymousHandle();
  }
  return handle;
}

function slugify(parts: Array<string | null | undefined>, fallback: string): string {
  const raw = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return raw || fallback;
}

function roleEmailLocal(role: SeedRole): string {
  return role === "asker" ? "ask" : "reply";
}

function mapSeedUser(row: Record<string, unknown>): SeedUserView {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: (row.display_name as string | null) ?? null,
    anonymousHandle: String(row.anonymous_handle),
    internalKind: (row.internal_kind as string | null) ?? null,
    internalStatus: String(row.internal_status ?? "active"),
    internalSpawnKey: (row.internal_spawn_key as string | null) ?? null,
    onboardingComplete: row.onboarding_complete === true,
    createdIst: (row.created_ist as string | null) ?? null,
  };
}

const SEED_USER_SELECT = `
  id, email, display_name, anonymous_handle, internal_kind, internal_status,
  internal_spawn_key, onboarding_complete,
  to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist
`;

async function loadSchool(
  client: PoolClient,
  schoolId: string
): Promise<SchoolRow | null> {
  const { rows } = await client.query(
    `SELECT id, name, branch, city, state, locality, pin_code, normalized_key
     FROM schools
     WHERE id = $1
       AND redirect_to_school_id IS NULL
       AND normalized_key <> 'school_not_specified||unknown'`,
    [schoolId]
  );
  return (rows[0] as SchoolRow | undefined) ?? null;
}

async function resolveCurriculumGrade(
  client: PoolClient,
  curriculumId?: string | null,
  gradeId?: string | null
): Promise<{ curriculumId: string; gradeId: string } | { error: string }> {
  if (curriculumId && gradeId) {
    const check = await client.query(
      `SELECT g.id
       FROM curriculum_grades g
       WHERE g.id = $1 AND g.curriculum_id = $2`,
      [gradeId, curriculumId]
    );
    if (check.rows.length === 0) {
      return { error: "Grade does not match curriculum" };
    }
    return { curriculumId, gradeId };
  }

  const { rows } = await client.query(
    `SELECT c.id AS curriculum_id, g.id AS grade_id
     FROM curricula c
     JOIN curriculum_grades g ON g.curriculum_id = c.id
     ORDER BY
       CASE WHEN c.code = 'CBSE' THEN 0 ELSE 1 END,
       c.sort_order,
       g.sort_order
     LIMIT 1`
  );
  if (rows.length === 0) {
    return { error: "No curriculum/grade fixtures available" };
  }
  return {
    curriculumId: String(rows[0].curriculum_id),
    gradeId: String(rows[0].grade_id),
  };
}

async function ensureSeedUser(
  client: PoolClient,
  params: {
    role: SeedRole;
    spawnKey: string;
    email: string;
    displayName: string;
    school: SchoolRow;
    pinCode: string;
    locality: string | null;
    city: string;
    state: string;
    curriculumId: string;
    gradeId: string;
    actor?: string | null;
  }
): Promise<{ user: SeedUserView; created: boolean }> {
  const existing = await client.query(
    `SELECT ${SEED_USER_SELECT}
     FROM users WHERE internal_spawn_key = $1`,
    [params.spawnKey]
  );
  if (existing.rows[0]) {
    return { user: mapSeedUser(existing.rows[0]), created: false };
  }

  const byEmail = await client.query(
    `SELECT id FROM users WHERE email = $1`,
    [params.email]
  );
  if (byEmail.rows.length > 0) {
    throw new Error(`Email already in use: ${params.email}`);
  }

  const handle = await uniqueHandle(client);
  const avatarKey = defaultAvatarKeyForHandle(handle);
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);

  const { rows } = await client.query(
    `INSERT INTO users (
       email, password_hash, role, display_name, anonymous_handle, avatar_key,
       onboarding_complete, is_internal, internal_status, internal_kind, internal_spawn_key
     )
     VALUES ($1, $2, 'parent', $3, $4, $5, true, true, 'active', $6, $7)
     RETURNING ${SEED_USER_SELECT}`,
    [
      params.email,
      passwordHash,
      params.displayName,
      handle,
      avatarKey,
      params.role,
      params.spawnKey,
    ]
  );
  const userId = String(rows[0].id);

  await client.query(
    `INSERT INTO user_locations (
       user_id, country_code, pin_code, locality, city, state, updated_at
     )
     VALUES ($1, 'IN', $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET
       country_code = EXCLUDED.country_code,
       pin_code = EXCLUDED.pin_code,
       locality = EXCLUDED.locality,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       updated_at = now()`,
    [userId, params.pinCode, params.locality, params.city, params.state]
  );

  const childExists = await client.query(
    `SELECT id FROM children WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (childExists.rows.length === 0) {
    await client.query(
      `INSERT INTO children (
         user_id, nickname, gender, track, curriculum_id, grade_id, school_id
       )
       VALUES ($1, NULL, 'unspecified', 'school', $2, $3, $4)`,
      [userId, params.curriculumId, params.gradeId, params.school.id]
    );
  }

  await syncCircleMembership(client, userId);

  await client.query(
    `INSERT INTO admin_seed_actions (action, actor, target_user_id, payload)
     VALUES ('spawn', $1, $2, $3::jsonb)`,
    [
      params.actor ?? null,
      userId,
      JSON.stringify({
        spawnKey: params.spawnKey,
        role: params.role,
        schoolId: params.school.id,
        email: params.email,
      }),
    ]
  );

  return { user: mapSeedUser(rows[0]), created: true };
}

export async function spawnInternalPair(
  client: PoolClient,
  body: {
    target: SeedTarget;
    schoolId?: string;
    curriculumId?: string;
    gradeId?: string;
    pinCode?: string;
    actor?: string | null;
  }
): Promise<
  | {
      ok: true;
      target: SeedTarget;
      school: { id: string; name: string; city: string | null };
      asker: SeedUserView;
      responder: SeedUserView;
      created: { asker: boolean; responder: boolean };
    }
  | { ok: false; error: string; status: number }
> {
  const target = body.target;
  if (!["school", "curriculum", "school_class"].includes(target)) {
    return { ok: false, error: "Invalid target", status: 400 };
  }
  if (!body.schoolId) {
    return { ok: false, error: "schoolId is required", status: 400 };
  }

  const school = await loadSchool(client, body.schoolId);
  if (!school) {
    return { ok: false, error: "School not found", status: 404 };
  }

  const pinCode = (body.pinCode ?? school.pin_code ?? "").trim();
  if (!/^\d{6}$/.test(pinCode)) {
    return {
      ok: false,
      error: "pinCode is required (6-digit) when the school has no pin",
      status: 400,
    };
  }

  const grade = await resolveCurriculumGrade(
    client,
    body.curriculumId,
    body.gradeId
  );
  if ("error" in grade) {
    return { ok: false, error: grade.error, status: 400 };
  }

  if (target === "curriculum" || target === "school_class") {
    if (!body.curriculumId || !body.gradeId) {
      return {
        ok: false,
        error: "curriculumId and gradeId are required for this target",
        status: 400,
      };
    }
  }

  const schoolSlug = slugify(
    [school.name, school.branch, school.city, school.id.slice(0, 8)],
    "school"
  );
  const currSlug = slugify([grade.curriculumId.slice(0, 8)], "curr");
  const gradeSlug = slugify([grade.gradeId.slice(0, 8)], "grade");
  const scopeKey =
    target === "school"
      ? `school:${school.id}:curr:${grade.curriculumId}:grade:${grade.gradeId}`
      : target === "curriculum"
        ? `curriculum:${grade.curriculumId}:school:${school.id}:grade:${grade.gradeId}`
        : `school_class:${school.id}:${grade.curriculumId}:${grade.gradeId}`;

  // Keep emails unique per school + curriculum + role
  const emailSlug = slugify(
    [school.name, school.branch, school.city, currSlug, gradeSlug, school.id.slice(0, 8)],
    "school"
  );

  const city = school.city?.trim() || "Hyderabad";
  const state = school.state?.trim() || "Telangana";
  const locality = school.locality?.trim() || null;

  const roles: SeedRole[] = ["asker", "responder"];
  const created: Record<SeedRole, boolean> = { asker: false, responder: false };
  const users: Partial<Record<SeedRole, SeedUserView>> = {};

  for (const role of roles) {
    const spawnKey = `${scopeKey}:${role}`;
    const email = `internal.${roleEmailLocal(role)}.${target}.${emailSlug}@vaara.ai`;
    const displayName = role === "asker" ? "Curious parent" : "Helpful parent";
    const result = await ensureSeedUser(client, {
      role,
      spawnKey,
      email: email.toLowerCase(),
      displayName,
      school,
      pinCode,
      locality,
      city,
      state,
      curriculumId: grade.curriculumId,
      gradeId: grade.gradeId,
      actor: body.actor,
    });
    users[role] = result.user;
    created[role] = result.created;
  }

  return {
    ok: true,
    target,
    school: { id: school.id, name: school.name, city: school.city },
    asker: users.asker!,
    responder: users.responder!,
    created: { asker: created.asker, responder: created.responder },
  };
}

export async function listInternalSeeds(
  client: PoolClient,
  filters: {
    schoolId?: string | null;
    status?: string | null;
    limit?: number;
  }
): Promise<SeedUserView[]> {
  const params: unknown[] = [];
  let sql = `
    SELECT ${SEED_USER_SELECT}
    FROM users u
    WHERE u.is_internal IS TRUE
  `;
  if (filters.status === "active" || filters.status === "inactive") {
    params.push(filters.status);
    sql += ` AND u.internal_status = $${params.length}`;
  }
  if (filters.schoolId) {
    params.push(filters.schoolId);
    const p = `$${params.length}`;
    sql += ` AND (
      u.internal_spawn_key LIKE ('school:' || ${p}::text || ':%')
      OR u.internal_spawn_key LIKE ('%:school:' || ${p}::text || ':%')
      OR u.internal_spawn_key LIKE ('school_class:' || ${p}::text || ':%')
      OR EXISTS (
        SELECT 1 FROM children c
        WHERE c.user_id = u.id AND c.school_id = ${p}::uuid
      )
    )`;
  }
  params.push(Math.min(Math.max(filters.limit ?? 200, 1), 500));
  sql += ` ORDER BY u.created_at DESC LIMIT $${params.length}`;
  const { rows } = await client.query(sql, params);
  return rows.map((row) => mapSeedUser(row));
}

export async function setInternalStatus(
  client: PoolClient,
  userId: string,
  status: "active" | "inactive",
  actor?: string | null
): Promise<
  | { ok: true; user: SeedUserView }
  | { ok: false; error: string; status: number }
> {
  if (status !== "active" && status !== "inactive") {
    return { ok: false, error: "Invalid status", status: 400 };
  }

  const existing = await client.query(
    `SELECT id, is_internal FROM users WHERE id = $1`,
    [userId]
  );
  if (existing.rows.length === 0) {
    return { ok: false, error: "User not found", status: 404 };
  }
  if (existing.rows[0].is_internal !== true) {
    return { ok: false, error: "Not an internal account", status: 400 };
  }

  const { rows } = await client.query(
    `UPDATE users
     SET internal_status = $2,
         session_version = session_version + 1,
         updated_at = now()
     WHERE id = $1
     RETURNING ${SEED_USER_SELECT}`,
    [userId, status]
  );

  await client.query(
    `INSERT INTO admin_seed_actions (action, actor, target_user_id, payload)
     VALUES ('status', $1, $2, $3::jsonb)`,
    [actor ?? null, userId, JSON.stringify({ status })]
  );

  return { ok: true, user: mapSeedUser(rows[0]) };
}

export async function postAsInternal(
  client: PoolClient,
  params: {
    userId: string;
    circleId: string;
    body: string;
    title?: string | null;
    kind?: string | null;
    threadId?: string | null;
    replyToMessageId?: string | null;
    actor?: string | null;
  }
): Promise<
  | {
      ok: true;
      mode: "thread" | "reply";
      result: Record<string, unknown>;
      nudge: {
        circleId: string;
        threadId?: string | null;
        messageId?: string;
        seq?: number;
        authorId: string;
      };
    }
  | { ok: false; error: string; status: number }
> {
  const { rows } = await client.query(
    `SELECT id, is_internal, internal_status
     FROM users WHERE id = $1`,
    [params.userId]
  );
  if (rows.length === 0) {
    return { ok: false, error: "User not found", status: 404 };
  }
  if (rows[0].is_internal !== true) {
    return { ok: false, error: "Not an internal account", status: 400 };
  }
  if (rows[0].internal_status !== "active") {
    return { ok: false, error: "Account is inactive", status: 400 };
  }

  if (params.threadId) {
    const result = await createCircleMessage({
      client,
      userId: params.userId,
      circleId: params.circleId,
      threadId: params.threadId,
      body: params.body,
      clientMessageId: randomUUID(),
      replyToMessageId: params.replyToMessageId,
      authorRole: "parent",
    });
    if ("error" in result) {
      return { ok: false, error: result.error, status: result.status };
    }
    await client.query(
      `INSERT INTO admin_seed_actions (action, actor, target_user_id, payload)
       VALUES ('post_reply', $1, $2, $3::jsonb)`,
      [
        params.actor ?? null,
        params.userId,
        JSON.stringify({
          circleId: params.circleId,
          threadId: params.threadId,
          messageId: result.message.id,
        }),
      ]
    );
    return {
      ok: true,
      mode: "reply",
      result: result.message as unknown as Record<string, unknown>,
      nudge: {
        circleId: params.circleId,
        threadId: params.threadId,
        messageId: result.message.id,
        seq: result.message.seq,
        authorId: params.userId,
      },
    };
  }

  const thread = await createThread({
    client,
    userId: params.userId,
    circleId: params.circleId,
    title: params.title?.trim() || params.body.trim().slice(0, 80) || "Question",
    body: params.body,
    kind: params.kind ?? "question",
  });
  if ("error" in thread) {
    return { ok: false, error: thread.error, status: thread.status };
  }

  await client.query(
    `INSERT INTO admin_seed_actions (action, actor, target_user_id, payload)
     VALUES ('post_thread', $1, $2, $3::jsonb)`,
    [
      params.actor ?? null,
      params.userId,
      JSON.stringify({
        circleId: params.circleId,
        threadId: thread.thread.id,
      }),
    ]
  );

  return {
    ok: true,
    mode: "thread",
    result: thread.thread,
    nudge: {
      circleId: params.circleId,
      threadId: String(thread.thread.id),
      seq: Number(thread.thread.created_seq ?? thread.thread.last_activity_seq ?? 0),
      authorId: params.userId,
    },
  };
}

const TEST_EMAIL_SQL = `(
  u.email ILIKE '%@vaara.test'
  OR u.email ILIKE '%@example.com'
  OR u.email ILIKE '%@test.com'
  OR u.email ILIKE '%cloudtestlabaccounts.com'
  OR u.email ILIKE 'speedtest.%'
)`;

export type SeedGapCircle = {
  id: string;
  circleType: string;
  key: string;
  displayName: string;
  realParents: number;
  activeInternal: number;
  recentThreads7d: number;
  schoolId: string | null;
  curriculumId: string | null;
  gradeId: string | null;
  pinCode: string | null;
  curriculumCode: string | null;
  gradeCode: string | null;
};

export type SeedSuggestion = {
  id: string;
  reason: string;
  priority: number;
  coversGapCount: number;
  coversGaps: Array<{ id: string; displayName: string; circleType: string }>;
  spawn: {
    target: SeedTarget;
    schoolId: string;
    schoolName: string;
    pinCode: string;
    curriculumId: string;
    curriculumCode: string;
    gradeId: string;
    gradeCode: string;
    gradeLabel: string;
  };
  alreadyCovered: boolean;
};

function predictedKeys(params: {
  schoolKey: string;
  curriculumCode: string;
  gradeCode: string;
  pinCode: string;
}): string[] {
  return [
    `SCHOOL_${params.schoolKey}`,
    `CURR_${params.curriculumCode}`,
    `CLASS_${params.curriculumCode}_${params.gradeCode}`,
    `SCHOOL_CLASS_${params.schoolKey}_${params.curriculumCode}_${params.gradeCode}`,
    `PIN_${params.pinCode}`,
  ];
}

/**
 * Find circles with real parents but fewer than 2 active internal members,
 * then suggest high-overlap spawn recipes (school + curriculum/grade + PIN).
 */
export async function findSeedGaps(
  client: PoolClient,
  options?: {
    minRealParents?: number;
    maxGaps?: number;
    maxSuggestions?: number;
  }
): Promise<{
  generatedAt: string;
  summary: {
    gapCircles: number;
    suggestions: number;
    realParentsInGaps: number;
  };
  gaps: SeedGapCircle[];
  suggestions: SeedSuggestion[];
}> {
  const minReal = Math.max(Number(options?.minRealParents ?? 1), 1);
  const maxGaps = Math.min(Math.max(Number(options?.maxGaps ?? 80), 1), 200);
  const maxSuggestions = Math.min(
    Math.max(Number(options?.maxSuggestions ?? 25), 1),
    50
  );

  const { rows: gapRows } = await client.query(
    `WITH real_members AS (
       SELECT cm.circle_id, COUNT(*)::int AS real_n
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE u.role = 'parent'
         AND COALESCE(u.is_internal, false) IS NOT TRUE
         AND NOT ${TEST_EMAIL_SQL}
       GROUP BY cm.circle_id
     ),
     internal_members AS (
       SELECT cm.circle_id, COUNT(*)::int AS internal_n
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE u.is_internal IS TRUE
         AND u.internal_status = 'active'
         AND u.internal_kind IN ('asker', 'responder')
       GROUP BY cm.circle_id
     ),
     recent AS (
       SELECT circle_id, COUNT(*)::int AS thread_n
       FROM circle_threads
       WHERE created_at >= now() - interval '7 days'
         AND status <> 'deleted'
       GROUP BY circle_id
     )
     SELECT
       c.id,
       c.circle_type::text AS circle_type,
       c.key,
       c.display_name,
       c.metadata,
       r.real_n,
       COALESCE(i.internal_n, 0)::int AS internal_n,
       COALESCE(rc.thread_n, 0)::int AS recent_threads
     FROM circles c
     JOIN real_members r ON r.circle_id = c.id
     LEFT JOIN internal_members i ON i.circle_id = c.id
     LEFT JOIN recent rc ON rc.circle_id = c.id
     WHERE c.circle_type IN ('school', 'curriculum', 'class', 'locality', 'school_class')
       AND r.real_n >= $1
       AND COALESCE(i.internal_n, 0) < 2
     ORDER BY
       (2 - COALESCE(i.internal_n, 0)) DESC,
       r.real_n DESC,
       COALESCE(rc.thread_n, 0) ASC,
       c.circle_type,
       c.display_name
     LIMIT $2`,
    [minReal, maxGaps]
  );

  const gaps: SeedGapCircle[] = gapRows.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id),
      circleType: String(row.circle_type),
      key: String(row.key),
      displayName: String(row.display_name),
      realParents: Number(row.real_n),
      activeInternal: Number(row.internal_n),
      recentThreads7d: Number(row.recent_threads),
      schoolId: meta.school_id ? String(meta.school_id) : null,
      curriculumId: meta.curriculum_id ? String(meta.curriculum_id) : null,
      gradeId: meta.grade_id ? String(meta.grade_id) : null,
      pinCode: meta.pin_code ? String(meta.pin_code) : null,
      curriculumCode: meta.code ? String(meta.code) : null,
      gradeCode: meta.grade_code ? String(meta.grade_code) : null,
    };
  });

  const gapByKey = new Map(gaps.map((g) => [g.key, g]));

  type Candidate = {
    schoolId: string;
    schoolName: string;
    schoolKey: string;
    pinCode: string;
    curriculumId: string;
    curriculumCode: string;
    gradeId: string;
    gradeCode: string;
    gradeLabel: string;
    score: number;
    source: string;
  };

  const candidates: Candidate[] = [];

  // School gaps → use dominant real child curriculum/grade at that school
  for (const gap of gaps.filter((g) => g.circleType === "school" && g.schoolId)) {
    const { rows } = await client.query(
      `SELECT
         ch.curriculum_id,
         ch.grade_id,
         cur.code AS curriculum_code,
         g.code AS grade_code,
         g.label AS grade_label,
         s.name AS school_name,
         s.normalized_key,
         s.pin_code AS school_pin,
         COUNT(*)::int AS n,
         MODE() WITHIN GROUP (ORDER BY loc.pin_code) AS member_pin
       FROM children ch
       JOIN users u ON u.id = ch.user_id
       JOIN schools s ON s.id = ch.school_id
       JOIN curricula cur ON cur.id = ch.curriculum_id
       JOIN curriculum_grades g ON g.id = ch.grade_id
       LEFT JOIN user_locations loc ON loc.user_id = u.id
       WHERE ch.school_id = $1
         AND ch.track = 'school'
         AND COALESCE(u.is_internal, false) IS NOT TRUE
         AND NOT ${TEST_EMAIL_SQL}
       GROUP BY ch.curriculum_id, ch.grade_id, cur.code, g.code, g.label,
                s.name, s.normalized_key, s.pin_code
       ORDER BY n DESC
       LIMIT 3`,
      [gap.schoolId]
    );
    for (const row of rows) {
      const pin = String(row.member_pin || row.school_pin || "").trim();
      if (!/^\d{6}$/.test(pin)) continue;
      candidates.push({
        schoolId: gap.schoolId!,
        schoolName: String(row.school_name),
        schoolKey: String(row.normalized_key),
        pinCode: pin,
        curriculumId: String(row.curriculum_id),
        curriculumCode: String(row.curriculum_code),
        gradeId: String(row.grade_id),
        gradeCode: String(row.grade_code),
        gradeLabel: String(row.grade_label),
        score: Number(row.n) * 10 + gap.realParents,
        source: `school gap · ${gap.displayName}`,
      });
    }
  }

  // Curriculum / class / school_class gaps → anchor on densest school among real members
  for (const gap of gaps.filter((g) =>
    ["curriculum", "class", "school_class"].includes(g.circleType)
  )) {
    const { rows } = await client.query(
      `SELECT
         ch.school_id,
         ch.curriculum_id,
         ch.grade_id,
         cur.code AS curriculum_code,
         g.code AS grade_code,
         g.label AS grade_label,
         s.name AS school_name,
         s.normalized_key,
         s.pin_code AS school_pin,
         COUNT(*)::int AS n,
         MODE() WITHIN GROUP (ORDER BY loc.pin_code) AS member_pin
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN children ch ON ch.user_id = u.id
       JOIN schools s ON s.id = ch.school_id
       JOIN curricula cur ON cur.id = ch.curriculum_id
       JOIN curriculum_grades g ON g.id = ch.grade_id
       LEFT JOIN user_locations loc ON loc.user_id = u.id
       WHERE cm.circle_id = $1
         AND ch.track = 'school'
         AND COALESCE(u.is_internal, false) IS NOT TRUE
         AND NOT ${TEST_EMAIL_SQL}
         AND s.normalized_key <> 'school_not_specified||unknown'
         AND ($2::uuid IS NULL OR ch.curriculum_id = $2::uuid)
         AND ($3::uuid IS NULL OR ch.grade_id = $3::uuid)
       GROUP BY ch.school_id, ch.curriculum_id, ch.grade_id, cur.code, g.code,
                g.label, s.name, s.normalized_key, s.pin_code
       ORDER BY n DESC
       LIMIT 3`,
      [gap.id, gap.curriculumId, gap.gradeId]
    );
    for (const row of rows) {
      const pin = String(row.member_pin || row.school_pin || "").trim();
      if (!/^\d{6}$/.test(pin)) continue;
      candidates.push({
        schoolId: String(row.school_id),
        schoolName: String(row.school_name),
        schoolKey: String(row.normalized_key),
        pinCode: pin,
        curriculumId: String(row.curriculum_id),
        curriculumCode: String(row.curriculum_code),
        gradeId: String(row.grade_id),
        gradeCode: String(row.grade_code),
        gradeLabel: String(row.grade_label),
        score: Number(row.n) * 8 + gap.realParents,
        source: `${gap.circleType} gap · ${gap.displayName}`,
      });
    }
  }

  // Locality gaps → densest school in that PIN
  for (const gap of gaps.filter((g) => g.circleType === "locality" && g.pinCode)) {
    const { rows } = await client.query(
      `SELECT
         ch.school_id,
         ch.curriculum_id,
         ch.grade_id,
         cur.code AS curriculum_code,
         g.code AS grade_code,
         g.label AS grade_label,
         s.name AS school_name,
         s.normalized_key,
         COUNT(*)::int AS n
       FROM user_locations loc
       JOIN users u ON u.id = loc.user_id
       JOIN children ch ON ch.user_id = u.id
       JOIN schools s ON s.id = ch.school_id
       JOIN curricula cur ON cur.id = ch.curriculum_id
       JOIN curriculum_grades g ON g.id = ch.grade_id
       WHERE loc.pin_code = $1
         AND ch.track = 'school'
         AND COALESCE(u.is_internal, false) IS NOT TRUE
         AND NOT ${TEST_EMAIL_SQL}
         AND s.normalized_key <> 'school_not_specified||unknown'
       GROUP BY ch.school_id, ch.curriculum_id, ch.grade_id, cur.code, g.code,
                g.label, s.name, s.normalized_key
       ORDER BY n DESC
       LIMIT 3`,
      [gap.pinCode]
    );
    for (const row of rows) {
      candidates.push({
        schoolId: String(row.school_id),
        schoolName: String(row.school_name),
        schoolKey: String(row.normalized_key),
        pinCode: gap.pinCode!,
        curriculumId: String(row.curriculum_id),
        curriculumCode: String(row.curriculum_code),
        gradeId: String(row.grade_id),
        gradeCode: String(row.grade_code),
        gradeLabel: String(row.grade_label),
        score: Number(row.n) * 7 + gap.realParents,
        source: `PIN gap · ${gap.displayName}`,
      });
    }
  }

  // Deduplicate candidates by spawn recipe; keep best score + merge sources
  const byRecipe = new Map<
    string,
    Candidate & { sources: string[] }
  >();
  for (const c of candidates) {
    const id = `school:${c.schoolId}:curr:${c.curriculumId}:grade:${c.gradeId}:pin:${c.pinCode}`;
    const existing = byRecipe.get(id);
    if (!existing) {
      byRecipe.set(id, { ...c, sources: [c.source] });
    } else {
      existing.score = Math.max(existing.score, c.score);
      if (!existing.sources.includes(c.source)) existing.sources.push(c.source);
    }
  }

  // Check which recipes already have an active asker spawn key
  const suggestions: SeedSuggestion[] = [];
  for (const [id, c] of byRecipe) {
    const keys = predictedKeys({
      schoolKey: c.schoolKey,
      curriculumCode: c.curriculumCode,
      gradeCode: c.gradeCode,
      pinCode: c.pinCode,
    });
    const covers = keys
      .map((key) => gapByKey.get(key))
      .filter(Boolean) as SeedGapCircle[];
    if (covers.length === 0) continue;

    const profileMatch = await client.query(
      `SELECT 1
       FROM users u
       JOIN children ch ON ch.user_id = u.id
       JOIN user_locations loc ON loc.user_id = u.id
       WHERE u.is_internal IS TRUE
         AND u.internal_status = 'active'
         AND u.internal_kind IN ('asker', 'responder')
         AND ch.school_id = $1::uuid
         AND ch.curriculum_id = $2::uuid
         AND ch.grade_id = $3::uuid
         AND loc.pin_code = $4
       LIMIT 1`,
      [c.schoolId, c.curriculumId, c.gradeId, c.pinCode]
    );
    const alreadyCovered = profileMatch.rows.length > 0;

    suggestions.push({
      id,
      reason: c.sources.slice(0, 3).join(" · "),
      priority: covers.length * 100 + c.score + (alreadyCovered ? -500 : 0),
      coversGapCount: covers.length,
      coversGaps: covers.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        circleType: g.circleType,
      })),
      spawn: {
        target: "school",
        schoolId: c.schoolId,
        schoolName: c.schoolName,
        pinCode: c.pinCode,
        curriculumId: c.curriculumId,
        curriculumCode: c.curriculumCode,
        gradeId: c.gradeId,
        gradeCode: c.gradeCode,
        gradeLabel: c.gradeLabel,
      },
      alreadyCovered,
    });
  }

  suggestions.sort((a, b) => b.priority - a.priority);

  const top = suggestions.slice(0, maxSuggestions);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      gapCircles: gaps.length,
      suggestions: top.filter((s) => !s.alreadyCovered).length,
      realParentsInGaps: gaps.reduce((sum, g) => sum + g.realParents, 0),
    },
    gaps,
    suggestions: top,
  };
}

