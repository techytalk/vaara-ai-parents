-- Typed PIN/city vs Vercel IP city vs school city for onboarding analysis.
-- No raw IP, no lat/lng. Does not change user_locations (product location).

CREATE TABLE IF NOT EXISTS onboarding_geo_signals (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  entered_country_code text,
  entered_pin text,
  entered_locality text,
  entered_city text,
  entered_state text,
  entered_at timestamptz,
  ip_city text,
  ip_region text,
  ip_country text,
  ip_captured_at timestamptz,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  school_city text,
  school_state text,
  school_pin text,
  school_at timestamptz,
  school_ip_city text,
  school_ip_region text,
  school_ip_country text,
  school_ip_captured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_geo_entered_city
  ON onboarding_geo_signals (entered_city);

CREATE INDEX IF NOT EXISTS idx_onboarding_geo_ip_city
  ON onboarding_geo_signals (ip_city);

CREATE INDEX IF NOT EXISTS idx_onboarding_geo_school_city
  ON onboarding_geo_signals (school_city);

CREATE OR REPLACE VIEW onboarding_geo_case AS
SELECT
  x.*,
  CASE
    WHEN x.entered_city IS NULL THEN 'entered_missing'
    WHEN x.school_city IS NULL AND x.ip_city IS NULL THEN 'entered_only'
    WHEN x.school_city IS NULL THEN 'entered_and_ip'
    WHEN x.entered_launch_metro AND x.ip_launch_metro AND x.school_launch_metro
      THEN 'launch_match'
    WHEN NOT x.entered_launch_metro
      AND x.ip_city IS NOT NULL
      AND lower(trim(x.ip_city)) = lower(trim(x.entered_city))
      AND NOT x.school_launch_metro
      THEN 'out_of_market'
    WHEN NOT x.entered_launch_metro
      AND x.ip_launch_metro
      AND NOT x.school_launch_metro
      THEN 'visiting'
    WHEN NOT x.entered_launch_metro
      AND x.ip_launch_metro
      AND x.school_launch_metro
      THEN 'hometown_pin_habit'
    WHEN x.entered_launch_metro
      AND x.school_launch_metro
      AND x.ip_city IS NOT NULL
      AND NOT x.ip_launch_metro
      THEN 'traveling_parent'
    ELSE 'other'
  END AS case_hint
FROM (
  SELECT
    s.*,
    (
      lower(trim(coalesce(s.entered_city, ''))) IN ('hyderabad', 'secunderabad')
      OR (
        upper(coalesce(s.entered_country_code, 'IN')) = 'IN'
        AND s.entered_pin LIKE '500%'
      )
    ) AS entered_launch_metro,
    (
      lower(trim(coalesce(s.ip_city, ''))) IN ('hyderabad', 'secunderabad')
    ) AS ip_launch_metro,
    (
      lower(trim(coalesce(s.school_city, ''))) IN ('hyderabad', 'secunderabad')
      OR s.school_pin LIKE '500%'
    ) AS school_launch_metro
  FROM onboarding_geo_signals s
) x;
