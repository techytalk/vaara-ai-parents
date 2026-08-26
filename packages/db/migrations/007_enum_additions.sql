-- Enum additions only. No inserts or table changes in this migration:
-- a new enum value cannot be used in the transaction that adds it.

ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'school_class';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'topic_digest';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_interest';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'disclosure_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'disclosure_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'carpool_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'expert_session';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'school_event';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'playdate_interest';
