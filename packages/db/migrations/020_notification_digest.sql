-- Digest push tracking and deferred outbox delivery (quiet hours).

ALTER TABLE notifications
  ADD COLUMN push_sent_at timestamptz;

CREATE INDEX idx_notifications_digest_pending
  ON notifications (user_id, created_at)
  WHERE push_sent_at IS NULL
    AND type IN (
      'circle_post',
      'topic_digest',
      'school_event',
      'activity_nearby',
      'listing_interest'
    );

ALTER TABLE notification_outbox
  ADD COLUMN send_after timestamptz NOT NULL DEFAULT now();

CREATE INDEX idx_notification_outbox_send_after
  ON notification_outbox (send_after)
  WHERE delivered_at IS NULL;
