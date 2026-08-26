CREATE TABLE playdate_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  age_band text NOT NULL,
  scope text NOT NULL,
  community_key text,
  pin_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id)
);

CREATE INDEX idx_playdate_optins_match
  ON playdate_optins(age_band, community_key, pin_code) WHERE active = true;
