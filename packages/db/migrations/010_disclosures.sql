CREATE TABLE conversation_disclosures (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_level int NOT NULL DEFAULT 0 CHECK (offered_level BETWEEN 0 AND 3),
  purpose text,
  offered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE disclosure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_level int NOT NULL,
  to_level int NOT NULL,
  purpose text,
  effective_level_after int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disclosure_events_conv
  ON disclosure_events(conversation_id, created_at);

CREATE TABLE user_contact_details (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name text,
  block_or_flat text,
  contact_phone text,
  vehicle_description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports
  ADD COLUMN target_disclosure_conversation_id uuid REFERENCES conversations(id);
