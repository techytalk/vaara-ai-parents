-- Vaara Parents initial schema

CREATE TYPE user_role AS ENUM ('parent', 'provider');
CREATE TYPE provider_type AS ENUM ('teacher', 'trainer', 'institution');
CREATE TYPE child_gender AS ENUM ('boy', 'girl', 'other', 'unspecified');
CREATE TYPE circle_type AS ENUM ('curriculum', 'locality', 'community');
CREATE TYPE post_tag AS ENUM ('question', 'recommendation', 'heads_up', 'general');
CREATE TYPE activity_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE notification_type AS ENUM (
  'circle_post', 'circle_reply', 'direct_message', 'activity_nearby', 'reminder', 'provider_update'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  role user_role NOT NULL,
  display_name text,
  anonymous_handle text UNIQUE NOT NULL,
  phone text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  push_token text,
  notification_prefs jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE providers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider_type provider_type NOT NULL,
  org_name text NOT NULL,
  description text,
  logo_url text,
  verified boolean NOT NULL DEFAULT false,
  service_pin_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_pin_codes ON providers USING GIN (service_pin_codes);

CREATE TABLE curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE curriculum_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES curricula(id),
  code text NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (curriculum_id, code)
);

CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname text,
  gender child_gender NOT NULL DEFAULT 'unspecified',
  curriculum_id uuid NOT NULL REFERENCES curricula(id),
  grade_id uuid NOT NULL REFERENCES curriculum_grades(id),
  school_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_children_user ON children(user_id);
CREATE INDEX idx_children_curriculum ON children(curriculum_id);

CREATE TABLE user_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  locality text,
  city text,
  state text,
  community_name text,
  community_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_locations_pin ON user_locations(pin_code);
CREATE INDEX idx_user_locations_community ON user_locations(community_key) WHERE community_key IS NOT NULL;

CREATE TABLE circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_type circle_type NOT NULL,
  key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circles_type_key ON circles(circle_type, key);

CREATE TABLE circle_members (
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX idx_circle_members_user ON circle_members(user_id);

CREATE TABLE circle_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  tag post_tag NOT NULL DEFAULT 'general',
  reply_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_posts_circle_created ON circle_posts(circle_id, created_at DESC);

CREATE TABLE circle_post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_replies_post ON circle_post_replies(post_id, created_at);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_from_circle_id uuid REFERENCES circles(id) ON DELETE SET NULL,
  initiated_from_post_id uuid REFERENCES circle_posts(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id, last_message_at DESC NULLS LAST);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);

CREATE TABLE direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_messages_conv_created ON direct_messages(conversation_id, created_at);

CREATE TABLE user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status activity_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  fee_amount numeric(10,2),
  fee_currency text DEFAULT 'INR',
  min_grade_id uuid REFERENCES curriculum_grades(id),
  max_grade_id uuid REFERENCES curriculum_grades(id),
  image_url text,
  location_text text,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_provider ON activities(provider_id);
CREATE INDEX idx_activities_status_starts ON activities(status, starts_at) WHERE status = 'published';
CREATE INDEX idx_activities_search ON activities USING GIN(search_vector);

CREATE TABLE activity_pin_codes (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  PRIMARY KEY (activity_id, pin_code)
);

CREATE INDEX idx_activity_pins_pin ON activity_pin_codes(pin_code);

CREATE TABLE activity_curricula (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES curricula(id),
  PRIMARY KEY (activity_id, curriculum_id)
);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  title text NOT NULL,
  note text,
  fire_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_pending ON reminders(fire_at) WHERE sent = false;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  target_post_id uuid REFERENCES circle_posts(id),
  target_conversation_id uuid REFERENCES conversations(id),
  target_user_id uuid REFERENCES users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
