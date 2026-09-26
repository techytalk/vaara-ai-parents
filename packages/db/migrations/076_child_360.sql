-- Child 360: normalized extras for activities, health, interests, pathway lean,
-- and opportunity plans. See docs/CHILD_360.md §11.

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS pathway_lean text;

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_pathway_lean_check;
ALTER TABLE children
  ADD CONSTRAINT children_pathway_lean_check
  CHECK (
    pathway_lean IS NULL
    OR char_length(btrim(pathway_lean)) BETWEEN 1 AND 40
  );

COMMENT ON COLUMN children.pathway_lean IS
  'Optional pathway lean after the current stage (e.g. pcm, pcb, commerce, arts, not_sure). Plain text for board/country flexibility.';

CREATE TABLE IF NOT EXISTS child_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name text NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  setting text NOT NULL
    CHECK (setting IN (
      'preschool', 'outside_class', 'at_home',
      'school', 'academy', 'casual'
    )),
  how_often text
    CHECK (how_often IS NULL OR char_length(how_often) <= 80),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS child_activities_child_sort
  ON child_activities (child_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS child_health_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  label text NOT NULL
    CHECK (label IN (
      'allergy', 'doctor', 'vision', 'dental', 'sleep', 'other'
    )),
  body text NOT NULL
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 280),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS child_health_notes_child_sort
  ON child_health_notes (child_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS child_interests (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  label text NOT NULL
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, label)
);

CREATE TABLE IF NOT EXISTS child_opportunity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  opportunity_slug text NOT NULL
    CHECK (char_length(btrim(opportunity_slug)) BETWEEN 1 AND 80),
  status text NOT NULL
    CHECK (status IN ('exploring', 'planning', 'this_season')),
  target_year smallint
    CHECK (
      target_year IS NULL
      OR target_year BETWEEN 2000 AND 2100
    ),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, opportunity_slug)
);

CREATE INDEX IF NOT EXISTS child_opportunity_plans_child_sort
  ON child_opportunity_plans (child_id, sort_order, created_at);
