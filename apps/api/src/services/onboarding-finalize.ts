import type { PoolClient } from "pg";
import { normalizeCommunityKey } from "../lib/community.js";
import {
  getIdempotentResponse,
  reserveIdempotencyKey,
} from "../lib/idempotency.js";
import { recordOnboardingGeoLocation } from "../lib/onboarding-geo.js";
import { readPlaceSelection } from "../lib/areas/selection.js";
import { resolveCanonicalArea } from "../lib/areas/resolve.js";
import { syncCircleMembership } from "./circle-sync.js";

const ROUTE = "POST /v1/me/onboarding/finalize";

export class FinalizeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type FinalizeInput = {
  onboardingAttemptId?: string;
  placeSelectionToken?: string;
  track?: "school" | "preschool";
  schoolId?: string;
  curriculumId?: string;
  gradeId?: string;
  ageYears?: number;
};

type HeaderSource = { header: (name: string) => string | undefined };

export async function prepareOnboardingFinalize(
  client: PoolClient,
  userId: string,
  body: FinalizeInput,
  headers: HeaderSource
): Promise<
  | { replay: unknown }
  | {
      replay?: undefined;
      childId: string;
      location: {
        countryCode: string;
        pinCode: string | null;
        postalCode: string | null;
        locality: string;
        city: string;
        state: string;
        communityName: string | null;
        communityKey: string | null;
        areaId: string;
      };
    }
> {
  const attemptId = body.onboardingAttemptId?.trim();
  if (!attemptId) throw new FinalizeError(400, "onboardingAttemptId is required");

  const existing = await getIdempotentResponse(client, userId, ROUTE, attemptId);
  if (existing?.statusCode === 200) return { replay: existing.response };
  if (existing) throw new FinalizeError(existing.statusCode, "Request in progress");

  const reserved = await reserveIdempotencyKey(client, userId, ROUTE, attemptId);
  if (reserved === "exists") {
    const again = await getIdempotentResponse(client, userId, ROUTE, attemptId);
    if (again?.statusCode === 200) return { replay: again.response };
    throw new FinalizeError(409, "Request in progress");
  }

  const selection = readPlaceSelection(body.placeSelectionToken ?? "");
  if (!selection || selection.needsArea || !selection.areaName) {
    throw new FinalizeError(400, "Choose where you live now before continuing");
  }

  const track = body.track === "preschool" ? "preschool" : "school";
  if (!body.schoolId) throw new FinalizeError(400, "schoolId is required");
  if (track === "preschool") {
    if (body.ageYears !== 3 && body.ageYears !== 4) {
      throw new FinalizeError(400, "ageYears must be 3 or 4 for preschool");
    }
  } else if (!body.curriculumId || !body.gradeId) {
    throw new FinalizeError(400, "curriculumId and gradeId are required");
  }

  const schoolCheck = await client.query(
    `SELECT id, city, state, pin_code
     FROM schools
     WHERE id = $1 AND normalized_key <> 'school_not_specified||unknown'
       AND redirect_to_school_id IS NULL`,
    [body.schoolId]
  );
  if (schoolCheck.rows.length === 0) throw new FinalizeError(404, "School not found");

  if (track === "school") {
    const gradeCheck = await client.query(
      `SELECT g.id FROM curriculum_grades g
       WHERE g.id = $1 AND g.curriculum_id = $2`,
      [body.gradeId, body.curriculumId]
    );
    if (gradeCheck.rows.length === 0) {
      throw new FinalizeError(400, "Grade does not match curriculum");
    }
  }

  const area = await resolveCanonicalArea(client, {
    countryCode: selection.countryCode,
    city: selection.city,
    state: selection.state,
    areaName: selection.areaName,
    providerPlaceId: selection.providerPlaceId,
    postalCode: selection.postalCode,
    createIfMissing: true,
  });
  if (!area) throw new FinalizeError(400, "Could not resolve that area");

  const communityName = selection.communityName?.trim() || null;
  const communityKey = communityName ? normalizeCommunityKey(communityName) : null;
  const pinCode = selection.postalCode?.trim() || null;

  await client.query(
    `INSERT INTO user_locations (
       user_id, country_code, pin_code, locality, city, state,
       community_name, community_key, area_id, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (user_id) DO UPDATE SET
       country_code = EXCLUDED.country_code,
       pin_code = EXCLUDED.pin_code,
       locality = EXCLUDED.locality,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       community_name = EXCLUDED.community_name,
       community_key = EXCLUDED.community_key,
       area_id = EXCLUDED.area_id,
       updated_at = now()`,
    [
      userId,
      area.countryCode,
      pinCode,
      area.canonicalName,
      area.city,
      area.state,
      communityName,
      communityKey,
      area.id,
    ]
  );

  await recordOnboardingGeoLocation(
    client,
    userId,
    {
      countryCode: area.countryCode,
      pinCode: pinCode ?? "",
      locality: area.canonicalName,
      city: area.city,
      state: area.state,
    },
    headers
  );

  const existingChild = await client.query<{ id: string }>(
    `SELECT id FROM children WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
    [userId]
  );

  let childId = existingChild.rows[0]?.id;
  if (!childId) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO children (
         user_id, gender, track, age_years, age_confirmed_at,
         curriculum_id, grade_id, school_id
       )
       VALUES ($1, 'unspecified', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        track,
        track === "preschool" ? body.ageYears : null,
        track === "preschool" ? new Date() : null,
        track === "school" ? body.curriculumId : null,
        track === "school" ? body.gradeId : null,
        body.schoolId,
      ]
    );
    childId = inserted.rows[0]?.id;
  }
  if (!childId) throw new FinalizeError(500, "Could not save child");

  await syncCircleMembership(client, userId);
  await client.query(
    "UPDATE users SET onboarding_complete = true, updated_at = now() WHERE id = $1",
    [userId]
  );

  const schoolRow = schoolCheck.rows[0] as {
    id: string;
    city: string | null;
    state: string | null;
    pin_code: string | null;
  };
  const { recordOnboardingGeoSchool } = await import("../lib/onboarding-geo.js");
  await recordOnboardingGeoSchool(
    client,
    userId,
    {
      id: schoolRow.id,
      city: schoolRow.city,
      state: schoolRow.state,
      pinCode: schoolRow.pin_code,
    },
    headers
  );

  return {
    childId,
    location: {
      countryCode: area.countryCode,
      pinCode,
      postalCode: pinCode,
      locality: area.canonicalName,
      city: area.city,
      state: area.state,
      communityName,
      communityKey,
      areaId: area.id,
    },
  };
}
