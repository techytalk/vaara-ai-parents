-- Blank geography must not be stored as national.
-- See docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md import rules.

ALTER TABLE opportunity_editions
  DROP CONSTRAINT IF EXISTS opportunity_editions_scope_level_check;

ALTER TABLE opportunity_editions
  ADD CONSTRAINT opportunity_editions_scope_level_check
  CHECK (scope_level IN (
    'school',
    'local',
    'district',
    'state',
    'national',
    'international',
    'unknown'
  ));

ALTER TABLE opportunity_editions
  ALTER COLUMN scope_level SET DEFAULT 'unknown';
