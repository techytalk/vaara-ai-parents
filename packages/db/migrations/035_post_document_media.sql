-- Documents (PDF / docx / xlsx) reuse circle_post_media. Existing image and
-- video rows are already scanned-and-served, so they default to 'clean'.

ALTER TABLE circle_post_media
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz;

ALTER TABLE circle_post_media
  DROP CONSTRAINT IF EXISTS circle_post_media_scan_status_check;

ALTER TABLE circle_post_media
  ADD CONSTRAINT circle_post_media_scan_status_check
  CHECK (scan_status IN ('pending', 'clean', 'blocked', 'failed'));

-- A document must carry the original name; images and videos never did.
ALTER TABLE circle_post_media
  DROP CONSTRAINT IF EXISTS circle_post_media_document_needs_name;

ALTER TABLE circle_post_media
  ADD CONSTRAINT circle_post_media_document_needs_name
  CHECK (media_type <> 'document' OR file_name IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_circle_post_media_scan_status
  ON circle_post_media(scan_status)
  WHERE scan_status <> 'clean';
