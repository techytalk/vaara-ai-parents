-- Canonical nearby areas for school-first onboarding.
-- PIN stays optional address data. New nearby circles use area_id.

ALTER TABLE user_locations
  ALTER COLUMN pin_code DROP NOT NULL;

ALTER TABLE user_locations
  ADD COLUMN IF NOT EXISTS area_id uuid;

CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  canonical_name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  normalized_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending_resolution', 'redirected')),
  canonical_area_id uuid REFERENCES areas(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_locations
  DROP CONSTRAINT IF EXISTS user_locations_area_id_fkey;

ALTER TABLE user_locations
  ADD CONSTRAINT user_locations_area_id_fkey
  FOREIGN KEY (area_id) REFERENCES areas(id);

CREATE INDEX IF NOT EXISTS idx_user_locations_area
  ON user_locations(area_id)
  WHERE area_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS area_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  UNIQUE (area_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_area_aliases_normalized
  ON area_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS area_sources (
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  PRIMARY KEY (provider, provider_place_id)
);

CREATE TABLE IF NOT EXISTS area_postal_codes (
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  postal_code text NOT NULL,
  PRIMARY KEY (area_id, postal_code)
);

CREATE TABLE IF NOT EXISTS area_resolution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_area_resolution_one_pending
  ON area_resolution_jobs(area_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS area_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_area_id uuid NOT NULL REFERENCES areas(id),
  to_area_id uuid NOT NULL REFERENCES areas(id),
  confidence numeric,
  model text,
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO areas (country_code, canonical_name, city, state, normalized_key, status)
VALUES
  ('IN', 'Gachibowli', 'Hyderabad', 'Telangana', 'IN|hyderabad|gachibowli', 'active'),
  ('IN', 'Financial District', 'Hyderabad', 'Telangana', 'IN|hyderabad|financial district', 'active'),
  ('IN', 'Rai Durg', 'Hyderabad', 'Telangana', 'IN|hyderabad|rai durg', 'active'),
  ('IN', 'Kokapet', 'Hyderabad', 'Telangana', 'IN|hyderabad|kokapet', 'active'),
  ('IN', 'Kondapur', 'Hyderabad', 'Telangana', 'IN|hyderabad|kondapur', 'active'),
  ('IN', 'KPHB', 'Hyderabad', 'Telangana', 'IN|hyderabad|kphb', 'active'),
  ('IN', 'Kukatpally', 'Hyderabad', 'Telangana', 'IN|hyderabad|kukatpally', 'active'),
  ('IN', 'Madhapur', 'Hyderabad', 'Telangana', 'IN|hyderabad|madhapur', 'active'),
  ('IN', 'HITEC City', 'Hyderabad', 'Telangana', 'IN|hyderabad|hitec city', 'active'),
  ('IN', 'Jubilee Hills', 'Hyderabad', 'Telangana', 'IN|hyderabad|jubilee hills', 'active'),
  ('IN', 'Banjara Hills', 'Hyderabad', 'Telangana', 'IN|hyderabad|banjara hills', 'active'),
  ('IN', 'Manikonda', 'Hyderabad', 'Telangana', 'IN|hyderabad|manikonda', 'active'),
  ('IN', 'Miyapur', 'Hyderabad', 'Telangana', 'IN|hyderabad|miyapur', 'active'),
  ('IN', 'Nallagandla', 'Hyderabad', 'Telangana', 'IN|hyderabad|nallagandla', 'active'),
  ('IN', 'Tellapur', 'Hyderabad', 'Telangana', 'IN|hyderabad|tellapur', 'active')
ON CONFLICT (normalized_key) DO NOTHING;

INSERT INTO area_aliases (area_id, alias, normalized_alias)
SELECT a.id, v.alias, v.normalized_alias
FROM (VALUES
  ('IN|hyderabad|gachibowli', 'Gachibowli Village', 'gachibowli village'),
  ('IN|hyderabad|financial district', 'Nanakramguda', 'nanakramguda'),
  ('IN|hyderabad|financial district', 'Financial District Nanakramguda', 'financial district nanakramguda'),
  ('IN|hyderabad|rai durg', 'Raidurg', 'raidurg'),
  ('IN|hyderabad|rai durg', 'Raidurgam', 'raidurgam'),
  ('IN|hyderabad|kphb', 'Kukatpally Housing Board', 'kukatpally housing board'),
  ('IN|hyderabad|kphb', 'KPHB Colony', 'kphb colony')
) AS v(area_key, alias, normalized_alias)
JOIN areas a ON a.normalized_key = v.area_key
ON CONFLICT (area_id, normalized_alias) DO NOTHING;
