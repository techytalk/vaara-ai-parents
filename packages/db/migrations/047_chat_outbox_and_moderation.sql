CREATE TABLE IF NOT EXISTS chat_event_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_event_outbox_pending
  ON chat_event_outbox (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS target_thread_id uuid REFERENCES circle_threads(id);

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS target_circle_message_id uuid REFERENCES circle_messages(id);

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS target_provider_channel_update_id uuid
    REFERENCES provider_channel_updates(id);

-- Content targets: exactly one. target_user_id may coexist as attribution,
-- matching existing post reports.
ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_one_content_target;

ALTER TABLE reports
  ADD CONSTRAINT reports_one_content_target CHECK (
    num_nonnulls(
      target_post_id,
      target_conversation_id,
      target_review_id,
      target_listing_id,
      target_disclosure_conversation_id,
      target_school_review_id,
      target_recommendation_id,
      target_thread_id,
      target_circle_message_id,
      target_provider_channel_update_id
    ) <= 1
  );
