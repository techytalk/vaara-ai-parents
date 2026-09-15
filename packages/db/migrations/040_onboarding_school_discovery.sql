-- Onboarding discovery: school locality/search, merge ledger, affinity, idempotency, catalogue gen

-- ---------------------------------------------------------------------------
-- 1. School directory columns
-- ---------------------------------------------------------------------------

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS redirect_to_school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text;

-- Backfill locality from branch (trim); keep free-text values as-is for now
UPDATE schools
SET locality = NULLIF(trim(branch), '')
WHERE locality IS NULL AND branch IS NOT NULL AND trim(branch) <> '';

-- Normalise a few known locality aliases into a cleaner locality label
UPDATE schools SET locality = 'Madhapur'
WHERE locality IN ('Madhapur / HITEC City', 'HITEC City/Madhapur', 'HITEC City');

UPDATE schools SET locality = 'Hyderabad'
WHERE locality IN ('Hyderbad', 'hyd');

-- Region: West Hyderabad seed set → west-hyderabad; other Hyderabad city rows → hyderabad
UPDATE schools
SET region = 'west-hyderabad'
WHERE region IS NULL
  AND (
    lower(coalesce(city, '')) IN ('hyderabad', 'secunderabad')
    OR lower(coalesce(locality, '')) IN (
      'kollur', 'gachibowli', 'kokapet', 'narsingi', 'tellapur', 'osman nagar',
      'neopolis', 'financial district', 'nanakramguda', 'madhapur', 'kondapur',
      'jubilee hills', 'banjara hills', 'manikonda', 'puppalaguda', 'nankramguda',
      'bowrampet', 'bachupally', 'miyapur', 'kukatpally', 'hitec city'
    )
    OR locality ILIKE '%HITEC%'
    OR locality ILIKE '%Madhapur%'
  );

UPDATE schools
SET region = 'hyderabad'
WHERE region IS NULL
  AND lower(coalesce(city, '')) IN ('hyderabad', 'secunderabad', 'medak');

-- Seed aliases for known short names (helps fuzzy create / local search)
UPDATE schools
SET aliases = ARRAY['Gaudium', 'Gaudium School', 'TGS']
WHERE lower(name) LIKE '%gaudium%'
  AND verified = true
  AND (aliases IS NULL OR aliases = '{}');

UPDATE schools
SET aliases = ARRAY['CGR', 'CGR Academy']
WHERE lower(name) LIKE '%cgr%'
  AND verified = true
  AND (aliases IS NULL OR aliases = '{}');

-- Mark already-verified schools with a verification timestamp if missing
UPDATE schools
SET verified_at = coalesce(verified_at, created_at, now())
WHERE verified = true AND verified_at IS NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS search_text text;

CREATE OR REPLACE FUNCTION schools_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := lower(
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.branch, '') || ' ' ||
    coalesce(NEW.locality, '') || ' ' ||
    array_to_string(coalesce(NEW.aliases, '{}'), ' ')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_search_text ON schools;
CREATE TRIGGER trg_schools_search_text
  BEFORE INSERT OR UPDATE OF name, branch, locality, aliases
  ON schools
  FOR EACH ROW
  EXECUTE FUNCTION schools_refresh_search_text();

UPDATE schools
SET search_text = lower(
  coalesce(name, '') || ' ' ||
  coalesce(branch, '') || ' ' ||
  coalesce(locality, '') || ' ' ||
  array_to_string(coalesce(aliases, '{}'), ' ')
)
WHERE search_text IS NULL;

CREATE INDEX IF NOT EXISTS idx_schools_search_trgm
  ON schools USING GIN (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_schools_locality
  ON schools (locality) WHERE verified AND redirect_to_school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schools_region
  ON schools (region) WHERE verified AND redirect_to_school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schools_redirect
  ON schools (redirect_to_school_id) WHERE redirect_to_school_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Privacy-safe PIN affinity (materialized; refresh via cron)
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS school_pin_affinity AS
SELECT
  ul.country_code,
  ul.pin_code,
  c.school_id,
  COUNT(DISTINCT c.user_id)::int AS parents
FROM children c
JOIN user_locations ul ON ul.user_id = c.user_id
JOIN schools s ON s.id = c.school_id
WHERE s.normalized_key <> 'school_not_specified||unknown'
  AND s.verified = true
  AND s.redirect_to_school_id IS NULL
GROUP BY ul.country_code, ul.pin_code, c.school_id
HAVING COUNT(DISTINCT c.user_id) >= 5;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_pin_affinity_pk
  ON school_pin_affinity (country_code, pin_code, school_id);

CREATE INDEX IF NOT EXISTS idx_school_pin_affinity_pin
  ON school_pin_affinity (country_code, pin_code, parents DESC);

-- Region-level affinity (also k>=5) for sparse PINs
CREATE MATERIALIZED VIEW IF NOT EXISTS school_region_affinity AS
SELECT
  s.region,
  c.school_id,
  COUNT(DISTINCT c.user_id)::int AS parents
FROM children c
JOIN schools s ON s.id = c.school_id
WHERE s.normalized_key <> 'school_not_specified||unknown'
  AND s.verified = true
  AND s.redirect_to_school_id IS NULL
  AND s.region IS NOT NULL
GROUP BY s.region, c.school_id
HAVING COUNT(DISTINCT c.user_id) >= 5;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_region_affinity_pk
  ON school_region_affinity (region, school_id);

-- ---------------------------------------------------------------------------
-- 3. Duplicate candidates + merge ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_a_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_b_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  score numeric(5,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'dismissed', 'merged', 'investigating')),
  admin_note text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_a_id, school_b_id)
);

CREATE INDEX IF NOT EXISTS idx_school_dup_candidates_status
  ON school_duplicate_candidates (status, score DESC);

CREATE TABLE IF NOT EXISTS school_merge_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  survivor_school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  candidate_id uuid REFERENCES school_duplicate_candidates(id) ON DELETE SET NULL,
  reviewer text NOT NULL,
  conflict_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_counts jsonb,
  affected_circle_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_merge_ledger_status
  ON school_merge_ledger (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. API idempotency (children create, school create)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route text NOT NULL,
  idempotency_key text NOT NULL,
  status_code int,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created
  ON api_idempotency_keys (created_at);

-- ---------------------------------------------------------------------------
-- 5. School catalogue generation metadata
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_catalog_generations (
  generation int PRIMARY KEY,
  schema_version int NOT NULL DEFAULT 1,
  checksum text NOT NULL,
  compressed_size int,
  row_count int NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_catalog_meta (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_generation int REFERENCES school_catalog_generations(generation),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO school_catalog_meta (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Seed open duplicate candidates from high-similarity verified/unverified pairs
-- ---------------------------------------------------------------------------

INSERT INTO school_duplicate_candidates (school_a_id, school_b_id, score)
SELECT
  a.id,
  b.id,
  similarity(a.search_text, b.search_text)::numeric(5,4)
FROM schools a
JOIN schools b ON a.id < b.id
WHERE a.redirect_to_school_id IS NULL
  AND b.redirect_to_school_id IS NULL
  AND a.normalized_key <> 'school_not_specified||unknown'
  AND b.normalized_key <> 'school_not_specified||unknown'
  AND a.search_text % b.search_text
  AND similarity(a.search_text, b.search_text) >= 0.45
ON CONFLICT (school_a_id, school_b_id) DO NOTHING;
