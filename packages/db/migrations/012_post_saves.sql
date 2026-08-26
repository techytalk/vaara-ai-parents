CREATE TABLE saved_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE INDEX idx_saved_items_user ON saved_items(user_id, created_at DESC);
