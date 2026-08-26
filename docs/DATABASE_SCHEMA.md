# Vaara Parents — Database Schema (Neon PostgreSQL)

All tables use `uuid` primary keys (`gen_random_uuid()`), `created_at` / `updated_at` timestamptz defaults.

---

## 1. Entity Relationship Overview

```
users ──┬── children ──┬── (drives curriculum circles)
        │              │
        ├── user_locations ── (pin + community → locality/community circles)
        │
        ├── circle_members ── circles
        │
        ├── circle_posts ── circle_post_replies
        │
        ├── conversations ── conversation_participants
        │       └── direct_messages
        │
        ├── user_blocks
        │
        ├── reminders
        │
        └── notifications

providers ── activities ── activity_pin_codes
                │
                └── activity_curricula (optional targeting)

curricula ── curriculum_grades
```

---

## 2. Core Tables

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| email | text UNIQUE NOT NULL | |
| password_hash | text | null if OAuth-only |
| role | enum | `parent`, `provider` |
| display_name | text | real name; **never exposed in circles** |
| anonymous_handle | text UNIQUE NOT NULL | e.g. `Parent-7F2A` |
| phone | text | optional, private |
| onboarding_complete | boolean DEFAULT false | |
| push_token | text | Expo push token |
| notification_prefs | jsonb | `{ circle_posts: true, ... }` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE user_role AS ENUM ('parent', 'provider');

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
```

### `providers` (extends users with role = provider)

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid PK FK users | |
| provider_type | enum | `teacher`, `trainer`, `institution` |
| org_name | text NOT NULL | public |
| description | text | |
| logo_url | text | |
| verified | boolean DEFAULT false | |
| service_pin_codes | text[] | indexed for activity discovery |

```sql
CREATE TYPE provider_type AS ENUM ('teacher', 'trainer', 'institution');

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
```

---

## 3. Reference Data

### `curricula`

```sql
CREATE TABLE curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,  -- 'IBDP', 'CBSE', 'SSC', 'IGCSE', 'IB_MYP', 'IB_PYP'
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
```

### `curriculum_grades`

```sql
CREATE TABLE curriculum_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES curricula(id),
  code text NOT NULL,         -- 'G8', 'Y11', 'LKG'
  label text NOT NULL,        -- 'Grade 8', 'Year 11'
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (curriculum_id, code)
);
```

---

## 4. Parent Domain

### `children`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK users | parent |
| nickname | text | private label |
| gender | enum | `boy`, `girl`, `other`, `unspecified` |
| curriculum_id | uuid FK curricula | |
| grade_id | uuid FK curriculum_grades | |
| school_name | text | optional, private by default |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE child_gender AS ENUM ('boy', 'girl', 'other', 'unspecified');

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
```

### `user_locations`

One active location per parent (v1). Pin code drives locality circle; community name drives community circle.

```sql
CREATE TABLE user_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  locality text,              -- area / neighborhood name
  city text,
  state text,
  community_name text,          -- raw: "Green Valley Apartments"
  community_key text,           -- normalized: "green_valley_apartments"
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_locations_pin ON user_locations(pin_code);
CREATE INDEX idx_user_locations_community ON user_locations(community_key) WHERE community_key IS NOT NULL;
```

**Normalization function** (app or DB):

```sql
-- community_key = lower(trim(regexp_replace(community_name, '[^a-zA-Z0-9]+', '_', 'g')))
```

---

## 5. Circles

### `circles`

Circles are **materialized** for fast feeds (recomputed on profile/child changes).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| circle_type | enum | `curriculum`, `locality`, `community` |
| key | text UNIQUE | `CURR_CBSE`, `PIN_560102`, `COMM_green_valley_apartments` |
| display_name | text | "CBSE Parents", "560102", "Green Valley Apartments" |
| metadata | jsonb | `{ curriculum_id, pin_code, community_key }` |

```sql
CREATE TYPE circle_type AS ENUM ('curriculum', 'locality', 'community');

CREATE TABLE circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_type circle_type NOT NULL,
  key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circles_type_key ON circles(circle_type, key);
```

### `circle_members`

```sql
CREATE TABLE circle_members (
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX idx_circle_members_user ON circle_members(user_id);
```

### Circle membership sync (application job)

On events: child added/updated/deleted, location updated:

1. Compute desired circle keys for user
2. Upsert `circles` rows if missing
3. Sync `circle_members` (insert new, delete stale)

**Algorithm (parent user):**

```
keys = []
for each child: keys += 'CURR_' + curriculum.code  -- circle_type curriculum
keys += 'PIN_' + pin_code                -- circle_type locality
if community_key: keys += 'COMM_' + community_key
```

---

## 6. Circle Content

### `circle_posts`

```sql
CREATE TYPE post_tag AS ENUM ('question', 'recommendation', 'heads_up', 'general');

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
```

API returns `author_anonymous_handle` + `author_child_context` (e.g. "IB MYP · G8") — joined at read time, not stored on post.

### `circle_post_replies`

```sql
CREATE TABLE circle_post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_replies_post ON circle_post_replies(post_id, created_at);
```

---

## 6b. Parent Direct Messages (1:1)

### `conversations`

One row per unique pair of parents. Created when either parent initiates a DM.

```sql
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
```

`user_a_id < user_b_id` (uuid compare) enforces canonical ordering so `(A,B)` and `(B,A)` map to one row.

**Create conversation (API):** verify shared circle via:

```sql
SELECT 1 FROM circle_members cm1
JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
WHERE cm1.user_id = $caller AND cm2.user_id = $peer
LIMIT 1;
```

### `conversation_participants`

Tracks per-user read state (extensible for future group chat).

```sql
CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,  -- user deleted/hid inbox entry
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
```

### `direct_messages`

```sql
CREATE TABLE direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_messages_conv_created ON direct_messages(conversation_id, created_at);
```

### `user_blocks`

```sql
CREATE TABLE user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
```

Sending a message fails if either party has blocked the other.

---

## 7. Activities (Provider)

### `activities`

```sql
CREATE TYPE activity_status AS ENUM ('draft', 'published', 'archived');

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
  location_text text,         -- "Sector 2, near metro"
  search_vector tsvector,     -- maintained by trigger
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_provider ON activities(provider_id);
CREATE INDEX idx_activities_status_starts ON activities(status, starts_at) WHERE status = 'published';
CREATE INDEX idx_activities_search ON activities USING GIN(search_vector);
```

### `activity_pin_codes`

```sql
CREATE TABLE activity_pin_codes (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  PRIMARY KEY (activity_id, pin_code)
);

CREATE INDEX idx_activity_pins_pin ON activity_pin_codes(pin_code);
```

### `activity_curricula` (optional targeting)

```sql
CREATE TABLE activity_curricula (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES curricula(id),
  PRIMARY KEY (activity_id, curriculum_id)
);
```

**Discovery query (parent):**

```sql
SELECT a.* FROM activities a
JOIN activity_pin_codes apc ON apc.activity_id = a.id
WHERE a.status = 'published'
  AND apc.pin_code = $user_pin
  AND (
    NOT EXISTS (SELECT 1 FROM activity_curricula ac WHERE ac.activity_id = a.id)
    OR EXISTS (
      SELECT 1 FROM activity_curricula ac
      JOIN children c ON c.curriculum_id = ac.curriculum_id
      WHERE ac.activity_id = a.id AND c.user_id = $user_id
    )
  )
ORDER BY a.starts_at NULLS LAST, a.created_at DESC;
```

---

## 8. Reminders & Notifications

### `reminders`

```sql
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
```

### `notifications`

```sql
CREATE TYPE notification_type AS ENUM (
  'circle_post', 'circle_reply', 'direct_message', 'activity_nearby', 'reminder', 'provider_update'
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}',  -- { circle_id, post_id, conversation_id, activity_id }
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
```

---

## 9. Moderation (minimal v1)

```sql
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  target_post_id uuid REFERENCES circle_posts(id),
  target_conversation_id uuid REFERENCES conversations(id),
  target_user_id uuid REFERENCES users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 10. Row-Level Security (Neon)

Enable RLS when using Supabase-style `auth.uid()` or custom JWT claim `user_id`.

Example policies:

```sql
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY children_own ON children
  FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY circle_posts_member_read ON circle_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_posts.circle_id
        AND cm.user_id = current_setting('app.user_id')::uuid
    )
  );

CREATE POLICY circle_posts_member_insert ON circle_posts
  FOR INSERT WITH CHECK (
    author_id = current_setting('app.user_id')::uuid
    AND EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_posts.circle_id
        AND cm.user_id = current_setting('app.user_id')::uuid
    )
  );

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY direct_messages_participant_read ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = direct_messages.conversation_id
        AND cp.user_id = current_setting('app.user_id')::uuid
    )
  );
```

API sets `SET app.user_id = ...` per request on pooled connection (or use service role + manual checks in BFF).

---

## 11. Indexes & Performance Notes

| Pattern | Index |
|---------|-------|
| Feed by circle | `(circle_id, created_at DESC)` |
| Members by user | `circle_members(user_id)` |
| Activities by pin | `activity_pin_codes(pin_code)` |
| DM history | `(conversation_id, created_at)` |
| Inbox | `conversations` by `user_a_id` / `user_b_id` + `last_message_at` |
| Pending reminders | partial index `WHERE sent = false` |

Neon: use **connection pooler** endpoint for API; direct endpoint for migrations only.

---

## 12. Seed Data Script Outline

1. Insert `curricula` + `curriculum_grades` (see ARCHITECTURE §8)
2. Optional: seed `circles` for major pin codes on first user in that pin (lazy create is fine)

Migration tooling: **Drizzle ORM** or **node-pg-migrate** with SQL files in `packages/db/migrations/`.
