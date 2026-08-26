CREATE TYPE carpool_status AS ENUM ('open', 'forming', 'active', 'paused', 'closed');
CREATE TYPE carpool_role AS ENUM ('driver', 'rider', 'either');

CREATE TABLE carpool_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  community_key text,
  pin_code text NOT NULL,
  role carpool_role NOT NULL,
  direction text NOT NULL,
  days_of_week int[] NOT NULL,
  departure_time time NOT NULL,
  seats int,
  status carpool_status NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_carpool_offers_match
  ON carpool_offers(school_id, pin_code, departure_time)
  WHERE status IN ('open', 'forming');

CREATE TABLE carpool_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status carpool_status NOT NULL DEFAULT 'forming',
  departure_time time NOT NULL,
  days_of_week int[] NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE carpool_participants (
  arrangement_id uuid NOT NULL REFERENCES carpool_arrangements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role carpool_role NOT NULL,
  disclosure_confirmed_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (arrangement_id, user_id)
);

CREATE OR REPLACE FUNCTION assert_carpool_fully_disclosed(arr_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM carpool_participants
    WHERE arrangement_id = arr_id
      AND left_at IS NULL
      AND disclosure_confirmed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'All carpool participants must complete level 3 disclosure';
  END IF;
END;
$$ LANGUAGE plpgsql;
