CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  sensitive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  follower_count int NOT NULL DEFAULT 0,
  post_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_topics_active ON topics(active, name);

CREATE TABLE topic_aliases (
  alias text PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE post_topics (
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, topic_id)
);

CREATE INDEX idx_post_topics_topic ON post_topics(topic_id, post_id);

CREATE TABLE topic_follows (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE topic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_name text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending',
  merged_into_topic_id uuid REFERENCES topics(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
