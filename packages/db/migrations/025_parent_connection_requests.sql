ALTER TYPE notification_type
  ADD VALUE IF NOT EXISTS 'connection_request';

CREATE TABLE IF NOT EXISTS parent_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  introduction text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (sender_id <> recipient_id),
  CHECK (introduction IS NULL OR char_length(introduction) <= 280)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_connection_requests_pending_pair
  ON parent_connection_requests (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id)
  )
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_parent_connection_requests_recipient
  ON parent_connection_requests(recipient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_connection_requests_sender
  ON parent_connection_requests(sender_id, status, created_at DESC);
