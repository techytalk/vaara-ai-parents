import assert from "node:assert/strict";
import { pool } from "@vaara/db";

export type AuditResult = {
  name: string;
  ok: boolean;
  detail?: string;
  error?: string;
};

export type TestUser = {
  email: string;
  password: string;
  token: string;
  userId: string;
  handle: string;
  role: "parent" | "provider";
};

export function auditEnabled(): boolean {
  return process.env.RUN_E2E_AUDIT === "1" && Boolean(process.env.TEST_API_URL);
}

export function apiUrl(): string {
  return process.env.TEST_API_URL!.replace(/\/$/, "");
}

export async function apiRequest<T = unknown>(
  path: string,
  token?: string,
  init?: RequestInit
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let body: T;
  try {
    body = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(
      `${init?.method ?? "GET"} ${path} returned non-JSON (${response.status}): ${text.slice(0, 200)}`
    );
  }
  return { status: response.status, body };
}

export async function apiOk<T = unknown>(
  path: string,
  token?: string,
  init?: RequestInit
): Promise<T> {
  const { status, body } = await apiRequest<T>(path, token, init);
  assert.ok(
    status >= 200 && status < 300,
    `${init?.method ?? "GET"} ${path} failed (${status}): ${JSON.stringify(body)}`
  );
  return body;
}

export async function registerUser(
  role: "parent" | "provider",
  label: string
): Promise<TestUser> {
  const stamp = Date.now();
  const email = `audit.${label}.${stamp}@vaara.test`;
  const password = `AuditPass${stamp}!`;
  const body = await apiOk<{
    token: string;
    user: {
      id: string;
      anonymousHandle: string;
      role: "parent" | "provider";
    };
  }>("/v1/auth/register", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  return {
    email,
    password,
    token: body.token,
    userId: body.user.id,
    handle: body.user.anonymousHandle,
    role: body.user.role,
  };
}

export async function dbQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function assertDb(
  name: string,
  sql: string,
  params: unknown[],
  predicate: (rows: Record<string, unknown>[]) => boolean,
  detail: string
): Promise<AuditResult> {
  try {
    const rows = await dbQuery(sql, params);
    const ok = predicate(rows);
    return { name, ok, detail: ok ? detail : `DB check failed: ${JSON.stringify(rows)}` };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runCheck(
  name: string,
  fn: () => Promise<void>
): Promise<AuditResult> {
  try {
    await fn();
    return { name, ok: true };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function printAuditReport(results: AuditResult[]) {
  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log("\n=== E2E audit report ===");
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    console.log(`${mark}  ${result.name}`);
    if (result.detail) console.log(`      ${result.detail}`);
    if (result.error) console.log(`      ${result.error}`);
  }
  console.log(`\n${passed.length}/${results.length} passed`);
  if (failed.length > 0) {
    throw new Error(`E2E audit failed: ${failed.map((f) => f.name).join(", ")}`);
  }
}

export async function onboardParent(
  token: string,
  fixture: { schoolId: string; curriculumId: string; gradeId: string },
  nickname: string
): Promise<void> {
  await apiOk("/v1/me/children", token, {
    method: "POST",
    body: JSON.stringify({
      nickname,
      curriculumId: fixture.curriculumId,
      gradeId: fixture.gradeId,
      schoolId: fixture.schoolId,
    }),
  });
}

export async function setParentLocation(token: string, pinCode = "560102"): Promise<void> {
  await apiOk("/v1/me/location", token, {
    method: "PATCH",
    body: JSON.stringify({
      pinCode,
      city: "Bengaluru",
      state: "Karnataka",
    }),
  });
}

export async function fetchOnboardingFixture(): Promise<{
  schoolId: string;
  curriculumId: string;
  gradeId: string;
}> {
  const rows = await dbQuery<{
    school_id: string;
    curriculum_id: string;
    grade_id: string;
  }>(
    `SELECT s.id AS school_id, g.curriculum_id, g.id AS grade_id
     FROM schools s
     CROSS JOIN curriculum_grades g
     WHERE s.normalized_key <> 'school_not_specified||unknown'
     ORDER BY s.created_at NULLS LAST
     LIMIT 1`
  );
  assert.ok(rows[0], "No school/grade fixture found — run db:seed");
  return {
    schoolId: rows[0].school_id,
    curriculumId: rows[0].curriculum_id,
    gradeId: rows[0].grade_id,
  };
}
