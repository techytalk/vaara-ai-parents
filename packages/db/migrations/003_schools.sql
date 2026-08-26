-- Schools catalog + children.school_id

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch text,
  city text NOT NULL,
  state text,
  pin_code text,
  normalized_key text UNIQUE NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schools_city ON schools (city);
CREATE INDEX idx_schools_pin ON schools (pin_code) WHERE pin_code IS NOT NULL;
CREATE INDEX idx_schools_name_trgm ON schools USING GIN (name gin_trgm_ops);
CREATE INDEX idx_schools_branch_trgm ON schools USING GIN (branch gin_trgm_ops);

INSERT INTO schools (name, branch, city, normalized_key, verified)
VALUES ('School not specified', NULL, 'Unknown', 'school_not_specified||unknown', true)
ON CONFLICT (normalized_key) DO NOTHING;

ALTER TABLE children ADD COLUMN school_id uuid REFERENCES schools(id);

INSERT INTO schools (name, branch, city, normalized_key)
SELECT DISTINCT
  trim(ch.school_name),
  NULL,
  'Unknown',
  lower(regexp_replace(trim(ch.school_name), '[^a-zA-Z0-9]+', '_', 'g'))
    || '||unknown'
FROM children ch
WHERE ch.school_name IS NOT NULL AND trim(ch.school_name) <> ''
ON CONFLICT (normalized_key) DO NOTHING;

UPDATE children ch
SET school_id = s.id
FROM schools s
WHERE ch.school_id IS NULL
  AND ch.school_name IS NOT NULL
  AND trim(ch.school_name) <> ''
  AND s.normalized_key =
    lower(regexp_replace(trim(ch.school_name), '[^a-zA-Z0-9]+', '_', 'g'))
    || '||unknown';

UPDATE children
SET school_id = (SELECT id FROM schools WHERE normalized_key = 'school_not_specified||unknown')
WHERE school_id IS NULL;

UPDATE children
SET nickname = 'Child'
WHERE nickname IS NULL OR trim(nickname) = '';

ALTER TABLE children
  ALTER COLUMN nickname SET NOT NULL,
  ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE children DROP COLUMN school_name;
