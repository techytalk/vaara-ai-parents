ALTER TABLE users
  ADD COLUMN apple_sub text;

CREATE UNIQUE INDEX idx_users_apple_sub
  ON users (apple_sub)
  WHERE apple_sub IS NOT NULL;
