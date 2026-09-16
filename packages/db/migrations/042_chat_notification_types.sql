-- Enum additions only. No inserts or table changes in this migration:
-- a new enum value cannot be used in the transaction that adds it.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'group_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'thread_reply';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'thread_mention';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'provider_response';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_update';
