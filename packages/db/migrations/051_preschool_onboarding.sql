-- Preschool onboarding: school kind, children track/age, age circles.
-- See docs/PRESCHOOL_ONBOARDING.md

CREATE TYPE school_kind AS ENUM ('preschool', 'school');

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS kind school_kind NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS offers_preschool boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_schools_kind_verified
  ON schools (kind)
  WHERE verified AND redirect_to_school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schools_offers_preschool
  ON schools (offers_preschool)
  WHERE offers_preschool AND verified AND redirect_to_school_id IS NULL;

ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'age_locality';
ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'school_age';

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS age_years smallint,
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS experienced_age_years smallint,
  ADD COLUMN IF NOT EXISTS age_circle_until timestamptz;

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_track_check;
ALTER TABLE children
  ADD CONSTRAINT children_track_check
  CHECK (track IN ('school', 'preschool'));

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_age_years_check;
ALTER TABLE children
  ADD CONSTRAINT children_age_years_check
  CHECK (age_years IS NULL OR age_years IN (3, 4));

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_experienced_age_years_check;
ALTER TABLE children
  ADD CONSTRAINT children_experienced_age_years_check
  CHECK (experienced_age_years IS NULL OR experienced_age_years IN (3, 4));

ALTER TABLE children
  ALTER COLUMN curriculum_id DROP NOT NULL,
  ALTER COLUMN grade_id DROP NOT NULL;

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_track_fields_check;
ALTER TABLE children
  ADD CONSTRAINT children_track_fields_check CHECK (
    (
      track = 'school'
      AND curriculum_id IS NOT NULL
      AND grade_id IS NOT NULL
      AND age_years IS NULL
    )
    OR (
      track = 'preschool'
      AND curriculum_id IS NULL
      AND grade_id IS NULL
      AND age_years IN (3, 4)
    )
  );

-- Heuristic backfill: standalone preschool / daycare brands.
UPDATE schools
SET
  kind = 'preschool',
  offers_preschool = true
WHERE kind = 'school'
  AND (
    name ~* '(preschool|pre[- ]?school|playschool|play[- ]?school|daycare|day[- ]?care|montessori|kidzee|eurokids|euro kids|klay|kangaroo kids|dibber|footprints|firstcry|blue blocks|little[ -]?flowers|treehouse|hello kids|kangaro|pre[- ]?primary)'
    OR grades_offered ~* '(preschool|playschool|daycare|playgroup|pre[- ]?nursery)'
  )
  AND name !~* '\y(cbse|icse|igcse|ssc)\y'
  AND COALESCE(grades_offered, '') !~* '(grade\s*1|class\s*1|1[-–]12|nursery[-–]12|nursery[-–]10)';

-- K–12 campuses that advertise early years.
UPDATE schools
SET offers_preschool = true
WHERE kind = 'school'
  AND offers_preschool = false
  AND (
    grades_offered ~* '(nursery|lkg|ukg|kindergarten|pre[- ]?primary|pre[- ]?nursery|playgroup)'
    OR name ~* '(nursery|early years|junior school)'
  );

COMMENT ON COLUMN schools.kind IS 'preschool = standalone early-years campus; school = K–12 / formal school';
COMMENT ON COLUMN schools.offers_preschool IS 'True when campus accepts ~3–4 year olds (nursery wing or preschool)';
COMMENT ON COLUMN children.track IS 'school = board+grade path; preschool = age 3/4 path';
COMMENT ON COLUMN children.age_circle_until IS 'Keep age_locality + school_age membership until this time (experienced overlap)';
