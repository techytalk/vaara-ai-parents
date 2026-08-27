ALTER TABLE users
  ADD COLUMN google_sub text;

CREATE UNIQUE INDEX idx_users_google_sub
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;
