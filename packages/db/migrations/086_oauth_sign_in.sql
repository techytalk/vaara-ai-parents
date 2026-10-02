-- Sign in with Vaara for sister sites (JEE Prep first).
-- Additive. Does not change mobile login.

CREATE TABLE oauth_clients (
  client_id text PRIMARY KEY,
  name text NOT NULL,
  redirect_uris text[] NOT NULL,
  pairwise_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_auth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES oauth_clients (client_id),
  parent_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  code_challenge text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE oauth_subjects (
  client_id text NOT NULL REFERENCES oauth_clients (client_id),
  kind text NOT NULL CHECK (kind IN ('parent', 'child')),
  internal_id uuid NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, subject),
  UNIQUE (client_id, kind, internal_id)
);

INSERT INTO oauth_clients (client_id, name, redirect_uris, pairwise_salt)
VALUES (
  'jee',
  'JEE Prep',
  ARRAY[
    'http://localhost:3001/auth/callback',
    'https://vaara-jee-prep.vercel.app/auth/callback'
  ],
  encode(gen_random_bytes(32), 'hex')
)
ON CONFLICT (client_id) DO NOTHING;
