-- Enum addition only. No inserts or table changes in this migration:
-- a new enum value cannot be used in the transaction that adds it.

ALTER TYPE post_media_type ADD VALUE IF NOT EXISTS 'document';
