ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS category text;

UPDATE activities a
SET category = CASE
  WHEN p.provider_type = 'teacher' THEN 'tutoring'
  WHEN p.provider_type = 'trainer' THEN 'coaching'
  WHEN lower(a.title || ' ' || a.description) ~
    '(art|dance|music|piano|guitar|drawing|craft|theatre|drama|painting|singing)'
    THEN 'arts'
  ELSE 'classes'
END
FROM providers p
WHERE p.user_id = a.provider_id
  AND a.category IS NULL;

UPDATE activities
SET category = 'other'
WHERE category IS NULL;

ALTER TABLE activities
  ALTER COLUMN category SET DEFAULT 'other',
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_category_check;

ALTER TABLE activities
  ADD CONSTRAINT activities_category_check
  CHECK (category IN (
    'tutoring',
    'coaching',
    'classes',
    'arts',
    'sports',
    'other'
  ));

CREATE INDEX IF NOT EXISTS idx_activities_published_category
  ON activities(category, created_at DESC)
  WHERE status = 'published';
