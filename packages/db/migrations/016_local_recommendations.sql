CREATE TABLE local_practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  clinic_name text,
  pin_code text NOT NULL,
  locality text,
  city text,
  normalized_key text UNIQUE NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recommendation_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_practitioners_pin_category
  ON local_practitioners(pin_code, category);
CREATE INDEX idx_practitioners_name_trgm
  ON local_practitioners USING GIN (name gin_trgm_ops);

CREATE TABLE practitioner_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES local_practitioners(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note text,
  wait_time_band text,
  fee_band text,
  good_with_young_children boolean,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, author_id)
);

ALTER TABLE reports
  ADD COLUMN target_recommendation_id uuid REFERENCES practitioner_recommendations(id);
