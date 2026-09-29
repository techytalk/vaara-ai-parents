-- Nearby product rows can match on area_id.
-- PIN columns stay for rows that have not been mapped yet.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);

ALTER TABLE listings
  ALTER COLUMN pin_code DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_area
  ON listings(area_id, created_at DESC)
  WHERE area_id IS NOT NULL AND status = 'active';

ALTER TABLE carpool_offers
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);

ALTER TABLE carpool_offers
  ALTER COLUMN pin_code DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carpool_offers_area
  ON carpool_offers(school_id, area_id)
  WHERE area_id IS NOT NULL AND status IN ('open', 'forming');

ALTER TABLE playdate_optins
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);

ALTER TABLE playdate_optins
  ALTER COLUMN pin_code DROP NOT NULL;

CREATE TABLE IF NOT EXISTS activity_areas (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(id),
  PRIMARY KEY (activity_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_areas_area
  ON activity_areas(area_id);

CREATE TABLE IF NOT EXISTS provider_service_areas (
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(id),
  PRIMARY KEY (provider_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_service_areas_area
  ON provider_service_areas(area_id);

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
