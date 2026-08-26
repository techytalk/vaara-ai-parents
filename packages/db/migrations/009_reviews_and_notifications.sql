CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected', 'expired');

CREATE TABLE provider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  status verification_status NOT NULL DEFAULT 'pending',
  document_refs jsonb NOT NULL DEFAULT '[]',
  reviewed_by text,
  reviewer_note text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_verifications_provider
  ON provider_verifications(provider_id, created_at DESC);

CREATE TABLE provider_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  engagement_verified boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, author_id)
);

CREATE INDEX idx_provider_reviews_provider
  ON provider_reviews(provider_id, created_at DESC) WHERE hidden = false;

CREATE TABLE provider_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES provider_reviews(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE providers
  ADD COLUMN fee_min numeric(10,2),
  ADD COLUMN fee_max numeric(10,2),
  ADD COLUMN rating_avg numeric(3,2),
  ADD COLUMN rating_count int NOT NULL DEFAULT 0,
  ADD COLUMN last_confirmed_at timestamptz;

ALTER TABLE reports
  ADD COLUMN target_review_id uuid REFERENCES provider_reviews(id);

CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_outbox_pending
  ON notification_outbox(created_at) WHERE delivered_at IS NULL;

CREATE TABLE notification_mutes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  scope_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, scope_id)
);
