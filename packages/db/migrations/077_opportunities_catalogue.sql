-- Competitive Exams / Opportunities catalogue.
-- Spec: docs/VAARA_COMPETITIONS_IMPLEMENTATION_SPEC.md
-- Seed staging (not auto-published): docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md
-- Access: Vaara API only (no parent mobile grants / RLS as primary authz).

-- ---------------------------------------------------------------------------
-- Categories (subject tags)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL
    CHECK (char_length(btrim(code)) BETWEEN 1 AND 40),
  label text NOT NULL
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

INSERT INTO opportunity_categories (code, label, sort_order) VALUES
  ('mathematics', 'Mathematics', 10),
  ('science', 'Science', 20),
  ('english', 'English', 30),
  ('computing', 'Computing', 40),
  ('general_knowledge', 'General knowledge', 50),
  ('arts', 'Arts', 60),
  ('environment', 'Environment', 70),
  ('heritage', 'Heritage', 80),
  ('robotics', 'Robotics', 90),
  ('sports', 'Sports', 100),
  ('language', 'Language', 110),
  ('reasoning', 'Reasoning', 120)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stable opportunity identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL
    CHECK (char_length(btrim(slug)) BETWEEN 1 AND 80),
  title text NOT NULL
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  summary text
    CHECK (summary IS NULL OR char_length(summary) <= 500),
  description text
    CHECK (description IS NULL OR char_length(description) <= 8000),
  kind text NOT NULL
    CHECK (kind IN (
      'competition',
      'olympiad',
      'exam',
      'scholarship',
      'admission_route'
    )),
  organizer_name text
    CHECK (organizer_name IS NULL OR char_length(btrim(organizer_name)) BETWEEN 1 AND 200),
  official_url text
    CHECK (official_url IS NULL OR char_length(official_url) <= 2000),
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'published', 'retired')),
  retirement_reason text
    CHECK (retirement_reason IS NULL OR char_length(retirement_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS opportunities_publication_kind_idx
  ON opportunities (publication_status, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS opportunities_organizer_idx
  ON opportunities (organizer_name);

CREATE TABLE IF NOT EXISTS opportunity_category_links (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES opportunity_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, category_id)
);

CREATE INDEX IF NOT EXISTS opportunity_category_links_category_idx
  ON opportunity_category_links (category_id);

CREATE TABLE IF NOT EXISTS opportunity_slug_aliases (
  alias text PRIMARY KEY
    CHECK (char_length(btrim(alias)) BETWEEN 1 AND 80),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_slug_aliases_opportunity_idx
  ON opportunity_slug_aliases (opportunity_id);

-- ---------------------------------------------------------------------------
-- Editions (cycle / session specific)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  edition_key text NOT NULL
    CHECK (char_length(btrim(edition_key)) BETWEEN 1 AND 40),
  edition_label text NOT NULL
    CHECK (char_length(btrim(edition_label)) BETWEEN 1 AND 80),
  scope_level text NOT NULL DEFAULT 'national'
    CHECK (scope_level IN (
      'school', 'local', 'district', 'state', 'national', 'international'
    )),
  delivery_mode text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_mode IN ('online', 'in_person', 'hybrid', 'unknown')),
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'published', 'retired')),
  event_status text NOT NULL DEFAULT 'unknown'
    CHECK (event_status IN (
      'scheduled', 'postponed', 'cancelled', 'completed', 'unknown'
    )),
  registration_method text NOT NULL DEFAULT 'unknown'
    CHECK (registration_method IN (
      'direct',
      'through_school',
      'nomination',
      'qualification',
      'mixed',
      'unknown'
    )),
  registration_url text
    CHECK (registration_url IS NULL OR char_length(registration_url) <= 2000),
  registration_instructions text
    CHECK (
      registration_instructions IS NULL
      OR char_length(registration_instructions) <= 4000
    ),
  eligibility_summary text
    CHECK (
      eligibility_summary IS NULL OR char_length(eligibility_summary) <= 4000
    ),
  curriculum_policy text NOT NULL DEFAULT 'unknown'
    CHECK (curriculum_policy IN ('all', 'restricted', 'unknown')),
  eligibility_completeness text NOT NULL DEFAULT 'partial'
    CHECK (eligibility_completeness IN ('partial', 'reviewed_complete')),
  fee_status text NOT NULL DEFAULT 'unknown'
    CHECK (fee_status IN ('free', 'paid', 'varies', 'unknown')),
  official_notice_url text
    CHECK (official_notice_url IS NULL OR char_length(official_notice_url) <= 2000),
  last_verified_at timestamptz,
  review_due_at timestamptz,
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1
    CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, edition_key)
);

CREATE INDEX IF NOT EXISTS opportunity_editions_listing_idx
  ON opportunity_editions (publication_status, scope_level, updated_at DESC, id);

CREATE INDEX IF NOT EXISTS opportunity_editions_opportunity_idx
  ON opportunity_editions (opportunity_id, publication_status);

-- ---------------------------------------------------------------------------
-- Stages and progression
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  stage_key text NOT NULL
    CHECK (char_length(btrim(stage_key)) BETWEEN 1 AND 40),
  title text NOT NULL
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  stage_level text
    CHECK (
      stage_level IS NULL
      OR stage_level IN (
        'school', 'local', 'district', 'state', 'national', 'international', 'other'
      )
    ),
  sequence int NOT NULL DEFAULT 1
    CHECK (sequence >= 1),
  entry_method text
    CHECK (
      entry_method IS NULL
      OR entry_method IN (
        'direct',
        'through_school',
        'nomination',
        'qualification',
        'mixed',
        'unknown'
      )
    ),
  qualification_description text
    CHECK (
      qualification_description IS NULL
      OR char_length(qualification_description) <= 2000
    ),
  event_status text NOT NULL DEFAULT 'unknown'
    CHECK (event_status IN (
      'scheduled', 'postponed', 'cancelled', 'completed', 'unknown'
    )),
  description text
    CHECK (description IS NULL OR char_length(description) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, stage_key)
);

CREATE INDEX IF NOT EXISTS opportunity_stages_edition_seq_idx
  ON opportunity_stages (edition_id, sequence, id);

CREATE TABLE IF NOT EXISTS opportunity_stage_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id uuid NOT NULL REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  to_stage_id uuid NOT NULL REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'qualifies_for'
    CHECK (relation IN ('qualifies_for')),
  conditions_text text
    CHECK (conditions_text IS NULL OR char_length(conditions_text) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_stage_id <> to_stage_id),
  UNIQUE (from_stage_id, to_stage_id, relation)
);

-- ---------------------------------------------------------------------------
-- Sources (before schedules/fees/rules that may reference them)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  url text NOT NULL
    CHECK (char_length(btrim(url)) BETWEEN 1 AND 2000),
  title text
    CHECK (title IS NULL OR char_length(title) <= 200),
  publisher text
    CHECK (publisher IS NULL OR char_length(publisher) <= 200),
  source_type text NOT NULL
    CHECK (source_type IN (
      'organizer_page',
      'official_bulletin',
      'school_notice',
      'government_notice',
      'secondary_reference'
    )),
  published_on date,
  accessed_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified', 'verified', 'disputed', 'stale'
    )),
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_sources_edition_idx
  ON opportunity_sources (edition_id);

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  schedule_type text NOT NULL
    CHECK (schedule_type IN (
      'registration', 'event', 'result', 'school_deadline'
    )),
  label text
    CHECK (label IS NULL OR char_length(label) <= 200),
  date_status text NOT NULL DEFAULT 'unknown'
    CHECK (date_status IN (
      'verified', 'estimated', 'unannounced', 'unknown', 'disputed'
    )),
  precision text NOT NULL DEFAULT 'unknown'
    CHECK (precision IN ('date', 'datetime', 'month', 'window', 'unknown')),
  starts_on date,
  ends_on date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text
    CHECK (timezone IS NULL OR char_length(timezone) <= 64),
  expected_period_text text
    CHECK (
      expected_period_text IS NULL OR char_length(expected_period_text) <= 200
    ),
  registration_override text
    CHECK (
      registration_override IS NULL
      OR registration_override IN ('suspended', 'closed', 'open')
    ),
  source_id uuid REFERENCES opportunity_sources(id) ON DELETE SET NULL,
  verified_at timestamptz,
  superseded_at timestamptz,
  notes text
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    ends_on IS NULL
    OR starts_on IS NULL
    OR ends_on >= starts_on
  ),
  CHECK (
    ends_at IS NULL
    OR starts_at IS NULL
    OR ends_at >= starts_at
  ),
  -- Date-only and datetime representations are mutually exclusive when both sides set.
  CHECK (
    NOT (
      (starts_on IS NOT NULL OR ends_on IS NOT NULL)
      AND (starts_at IS NOT NULL OR ends_at IS NOT NULL)
    )
  )
);

CREATE INDEX IF NOT EXISTS opportunity_schedules_edition_type_idx
  ON opportunity_schedules (edition_id, schedule_type);

CREATE INDEX IF NOT EXISTS opportunity_schedules_closing_idx
  ON opportunity_schedules (schedule_type, ends_on, id)
  WHERE superseded_at IS NULL AND schedule_type = 'registration';

-- ---------------------------------------------------------------------------
-- Eligibility rules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  alternative_group int NOT NULL DEFAULT 0
    CHECK (alternative_group >= 0),
  rule_type text NOT NULL
    CHECK (rule_type IN (
      'curriculum',
      'grade',
      'age',
      'school',
      'geography',
      'qualification',
      'other'
    )),
  operator text NOT NULL
    CHECK (operator IN ('in', 'between', 'equals', 'descriptive')),
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_text text
    CHECK (rule_text IS NULL OR char_length(rule_text) <= 2000),
  source_id uuid REFERENCES opportunity_sources(id) ON DELETE SET NULL,
  verified_at timestamptz,
  evaluation_mode text NOT NULL DEFAULT 'information_only'
    CHECK (evaluation_mode IN (
      'automatic', 'manual_review', 'information_only'
    )),
  rules_schema_version int NOT NULL DEFAULT 1
    CHECK (rules_schema_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_eligibility_rules_edition_idx
  ON opportunity_eligibility_rules (edition_id, alternative_group, rule_type);

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN (
      'eligibility_residence',
      'eligibility_school',
      'eligibility_domicile',
      'venue',
      'host_school',
      'participating_school',
      'discovery_area'
    )),
  country_code text
    CHECK (country_code IS NULL OR char_length(country_code) = 2),
  state_code text
    CHECK (state_code IS NULL OR char_length(btrim(state_code)) BETWEEN 1 AND 16),
  district_code text
    CHECK (district_code IS NULL OR char_length(district_code) <= 32),
  city_code text
    CHECK (city_code IS NULL OR char_length(city_code) <= 64),
  locality text
    CHECK (locality IS NULL OR char_length(locality) <= 200),
  pin_code text
    CHECK (pin_code IS NULL OR char_length(pin_code) <= 12),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  venue_name text
    CHECK (venue_name IS NULL OR char_length(venue_name) <= 200),
  address_text text
    CHECK (address_text IS NULL OR char_length(address_text) <= 500),
  source_id uuid REFERENCES opportunity_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_locations_edition_role_idx
  ON opportunity_locations (edition_id, role);

CREATE INDEX IF NOT EXISTS opportunity_locations_state_idx
  ON opportunity_locations (role, state_code)
  WHERE state_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Fees
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  label text NOT NULL
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  amount numeric(12, 2)
    CHECK (amount IS NULL OR amount >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  fee_type text NOT NULL
    CHECK (fee_type IN (
      'registration',
      'stage',
      'school_admin',
      'optional_material',
      'concession',
      'other'
    )),
  applicability_text text
    CHECK (
      applicability_text IS NULL OR char_length(applicability_text) <= 500
    ),
  eligibility_group text
    CHECK (
      eligibility_group IS NULL OR char_length(eligibility_group) <= 80
    ),
  is_mandatory boolean NOT NULL DEFAULT true,
  source_id uuid REFERENCES opportunity_sources(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_fees_edition_idx
  ON opportunity_fees (edition_id);

-- ---------------------------------------------------------------------------
-- Path node links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS path_node_opportunities (
  path_node_id uuid NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'related'
    CHECK (relationship IN (
      'explore_now', 'prepare_for_later', 'related'
    )),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (path_node_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS path_node_opportunities_opportunity_idx
  ON path_node_opportunities (opportunity_id);

-- ---------------------------------------------------------------------------
-- Daily suggestion buckets (class + curriculum + school state)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_suggestion_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid REFERENCES curricula(id) ON DELETE CASCADE,
  curriculum_grade_id uuid REFERENCES curriculum_grades(id) ON DELETE CASCADE,
  state_code text
    CHECK (state_code IS NULL OR char_length(btrim(state_code)) BETWEEN 1 AND 16),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  edition_id uuid REFERENCES opportunity_editions(id) ON DELETE CASCADE,
  rank int NOT NULL DEFAULT 0,
  reason_code text
    CHECK (reason_code IS NULL OR char_length(reason_code) <= 40),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    curriculum_id,
    curriculum_grade_id,
    state_code,
    opportunity_id,
    edition_id
  )
);

CREATE INDEX IF NOT EXISTS opportunity_suggestion_buckets_lookup_idx
  ON opportunity_suggestion_buckets (
    curriculum_id,
    curriculum_grade_id,
    state_code,
    rank,
    opportunity_id
  );

-- ---------------------------------------------------------------------------
-- Editorial editors + change log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_editors (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('editor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS opportunity_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'opportunity',
      'edition',
      'stage',
      'schedule',
      'fee',
      'rule',
      'location',
      'source',
      'category_link'
    )),
  entity_id uuid NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text
    CHECK (reason IS NULL OR char_length(reason) <= 500),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_change_log_entity_idx
  ON opportunity_change_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS opportunity_change_log_created_idx
  ON opportunity_change_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- Extend child_opportunity_plans (session-aware uniqueness)
-- ---------------------------------------------------------------------------

ALTER TABLE child_opportunity_plans
  ADD COLUMN IF NOT EXISTS opportunity_id uuid
    REFERENCES opportunities(id) ON DELETE RESTRICT;

ALTER TABLE child_opportunity_plans
  ADD COLUMN IF NOT EXISTS edition_id uuid
    REFERENCES opportunity_editions(id) ON DELETE RESTRICT;

ALTER TABLE child_opportunity_plans
  ADD COLUMN IF NOT EXISTS plan_lifecycle text NOT NULL DEFAULT 'active';

ALTER TABLE child_opportunity_plans
  DROP CONSTRAINT IF EXISTS child_opportunity_plans_plan_lifecycle_check;

ALTER TABLE child_opportunity_plans
  ADD CONSTRAINT child_opportunity_plans_plan_lifecycle_check
  CHECK (plan_lifecycle IN ('active', 'inactive'));

-- Edition must belong to opportunity when both set.
ALTER TABLE child_opportunity_plans
  DROP CONSTRAINT IF EXISTS child_opportunity_plans_edition_matches_opportunity;

-- Enforced in API; optional trigger later. Soft check via comment for now.
COMMENT ON COLUMN child_opportunity_plans.opportunity_id IS
  'Catalogue FK when mapped; nullable for legacy slug-only rows.';
COMMENT ON COLUMN child_opportunity_plans.edition_id IS
  'Session/cycle focus; required with opportunity_id for new active saves.';
COMMENT ON COLUMN child_opportunity_plans.plan_lifecycle IS
  'active | inactive. Inactive rows are excluded from unique active constraints.';

ALTER TABLE child_opportunity_plans
  DROP CONSTRAINT IF EXISTS child_opportunity_plans_child_id_opportunity_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS child_opportunity_plans_legacy_slug_active_uidx
  ON child_opportunity_plans (child_id, opportunity_slug)
  WHERE opportunity_id IS NULL AND plan_lifecycle = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS child_opportunity_plans_edition_active_uidx
  ON child_opportunity_plans (child_id, opportunity_id, edition_id)
  WHERE opportunity_id IS NOT NULL
    AND edition_id IS NOT NULL
    AND plan_lifecycle = 'active';

CREATE INDEX IF NOT EXISTS child_opportunity_plans_opportunity_idx
  ON child_opportunity_plans (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Feature flag helper (server reads env; optional DB override)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_feature_flags (
  key text PRIMARY KEY
    CHECK (char_length(btrim(key)) BETWEEN 1 AND 64),
  enabled boolean NOT NULL DEFAULT false,
  note text
    CHECK (note IS NULL OR char_length(note) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_feature_flags (key, enabled, note) VALUES
  (
    'competitive_exams',
    false,
    'Parent Competitive Exams catalogue. Keep false until seed published.'
  )
ON CONFLICT (key) DO NOTHING;
