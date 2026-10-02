-- Child-started approval, practice links, linked devices, and progress.
-- Additive. Does not change mobile login.

ALTER TABLE users ADD COLUMN IF NOT EXISTS origin_client text;

CREATE TABLE IF NOT EXISTS oauth_device_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash text UNIQUE NOT NULL,
  user_code text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES oauth_clients (client_id),
  nickname text NOT NULL,
  class_band text NOT NULL,
  age_band text NOT NULL,
  parent_email_enc text,
  parent_email_hmac text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'declined')),
  parent_id uuid REFERENCES users (id) ON DELETE CASCADE,
  child_id uuid REFERENCES children (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  email_hmac text PRIMARY KEY,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES oauth_clients (client_id),
  progress_token_hash text UNIQUE NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS child_prep_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('self', 'share')),
  invite_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS child_prep_progress (
  child_id uuid PRIMARY KEY REFERENCES children (id) ON DELETE CASCADE,
  client_id text NOT NULL,
  streak int NOT NULL DEFAULT 0,
  answered_count int NOT NULL DEFAULT 0,
  accuracy int,
  last_practiced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
