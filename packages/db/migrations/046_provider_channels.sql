CREATE TABLE IF NOT EXISTS provider_channels (
  provider_id uuid PRIMARY KEY REFERENCES providers(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO provider_channels (provider_id, status)
SELECT user_id, 'active' FROM providers
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS provider_channel_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_channels(provider_id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  title text NOT NULL,
  preview text,
  published_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'expired', 'moderated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_channel_updates_published
  ON provider_channel_updates (published_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS provider_channel_follows (
  provider_id uuid NOT NULL REFERENCES provider_channels(provider_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, user_id)
);

CREATE TABLE IF NOT EXISTS home_provider_update_impressions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  update_id uuid NOT NULL REFERENCES provider_channel_updates(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  PRIMARY KEY (user_id, update_id)
);
