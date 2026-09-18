-- Harden circle_message_media for chat attachments.
-- Table already exists (045); this adds type/file-name checks and a sort index.

ALTER TABLE circle_message_media
  DROP CONSTRAINT IF EXISTS circle_message_media_type_check;

ALTER TABLE circle_message_media
  ADD CONSTRAINT circle_message_media_type_check
  CHECK (media_type IN ('image', 'video', 'document'));

ALTER TABLE circle_message_media
  DROP CONSTRAINT IF EXISTS circle_message_media_document_file_name;

ALTER TABLE circle_message_media
  ADD CONSTRAINT circle_message_media_document_file_name
  CHECK (
    media_type <> 'document'
    OR (file_name IS NOT NULL AND btrim(file_name) <> '')
  );

CREATE INDEX IF NOT EXISTS idx_circle_message_media_message_sort
  ON circle_message_media (message_id, sort_order);
