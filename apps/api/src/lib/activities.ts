import type { PoolClient } from "pg";

export type ActivityRow = Record<string, unknown>;

export function mapActivity(
  row: ActivityRow,
  pinCodes: string[],
  curriculumIds: string[],
  provider?: {
    orgName: string;
    providerType: string;
    verified: boolean;
    ratingAvg?: number | null;
    ratingCount?: number;
    feeMin?: number | null;
    feeMax?: number | null;
  }
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    feeAmount: row.fee_amount != null ? Number(row.fee_amount) : null,
    feeCurrency: row.fee_currency,
    minGradeId: row.min_grade_id,
    maxGradeId: row.max_grade_id,
    locationText: row.location_text,
    imageUrl: row.image_url,
    pinCodes,
    curriculumIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    providerId: row.provider_id as string | undefined,
    provider: provider
      ? {
          orgName: provider.orgName,
          providerType: provider.providerType,
          verified: provider.verified,
          ratingAvg: provider.ratingAvg ?? null,
          ratingCount: provider.ratingCount ?? 0,
          feeMin: provider.feeMin ?? null,
          feeMax: provider.feeMax ?? null,
        }
      : undefined,
  };
}

export async function loadActivityExtras(
  client: PoolClient,
  activityId: string
): Promise<{ pinCodes: string[]; curriculumIds: string[] }> {
  const pins = await client.query(
    "SELECT pin_code FROM activity_pin_codes WHERE activity_id = $1",
    [activityId]
  );
  const curricula = await client.query(
    "SELECT curriculum_id FROM activity_curricula WHERE activity_id = $1",
    [activityId]
  );
  return {
    pinCodes: pins.rows.map((r) => r.pin_code),
    curriculumIds: curricula.rows.map((r) => r.curriculum_id),
  };
}

export async function syncActivityTargeting(
  client: PoolClient,
  activityId: string,
  pinCodes: string[],
  curriculumIds: string[]
) {
  await client.query("DELETE FROM activity_pin_codes WHERE activity_id = $1", [
    activityId,
  ]);
  await client.query(
    "DELETE FROM activity_curricula WHERE activity_id = $1",
    [activityId]
  );

  for (const pin of pinCodes) {
    await client.query(
      "INSERT INTO activity_pin_codes (activity_id, pin_code) VALUES ($1, $2)",
      [activityId, pin.trim()]
    );
  }

  for (const curriculumId of curriculumIds) {
    await client.query(
      "INSERT INTO activity_curricula (activity_id, curriculum_id) VALUES ($1, $2)",
      [activityId, curriculumId]
    );
  }
}
