-- Image and video attachments stored in S3 and delivered through a CDN.

CREATE TYPE post_media_type AS ENUM ('image', 'video');

CREATE TABLE circle_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  storage_key text UNIQUE NOT NULL,
  media_type post_media_type NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width int,
  height int,
  duration_ms int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (size_bytes > 0),
  CHECK (sort_order >= 0)
);

CREATE INDEX idx_circle_post_media_post
  ON circle_post_media(post_id, sort_order);
