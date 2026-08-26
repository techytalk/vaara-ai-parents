# Vaara Parents — Architecture

A React Native community app connecting parents by curriculum, locality, and housing community—while keeping parent identities private. Teachers, trainers, and institutions share activities scoped to geographic areas.

---

## 1. Product Summary

| Goal | Approach |
|------|----------|
| Connect parents nearby with similar schooling context | **Circles** auto-formed from curriculum, locality (pin code), and apartment community |
| Protect parent privacy | Display **anonymous handles** (e.g. `Parent-7F2A`); real names never shown in circles |
| Let parents exchange information | **Posts**, **threaded replies**, and **direct messages** between parents in shared circles |
| Surface relevant activities | Providers post activities tagged by location + optional curriculum/grade filters |
| Keep parents informed | Push notifications + in-app reminders for events, deadlines, and circle activity |

---

## 2. User Roles & Capabilities

### 2.1 Parent

- Sign up / sign in (email + OTP or social; phone optional)
- Add one or more **children** with:
  - Display label (optional internal nickname—not shown publicly)
  - Gender (boy / girl / other / prefer not to say)
  - Curriculum (IBDP, IB MYP, CBSE, SSC, IGCSE, …)
  - Grade / year (curriculum-specific enum)
  - School name (optional, can be hidden in circles)
- Set **location profile**:
  - Pin code (required for locality circle)
  - City / locality name
  - Apartment / gated community name (optional → community circle)
- Join **circles** automatically based on profile (see §3)
- **Communicate with other parents** (see §4):
  - Post questions, tips, and recommendations in a circle feed
  - Reply in threads on another parent’s post
  - Start a **direct message** with a parent from the member list or from a post (1:1, still anonymous)
- View **activities** from providers filtered by pin code / curriculum
- Set **reminders** on activities or custom notes
- Notification preferences per circle type

### 2.2 Teacher / Trainer / Institution (Provider)

Single role type in DB with `provider_type` discriminator:

| `provider_type` | Examples |
|-----------------|----------|
| `teacher` | Tutors, subject coaches |
| `trainer` | Sports, arts, coding bootcamps |
| `institution` | Schools, academies, activity centers |

Capabilities:

- Organization profile (name, logo, verified badge later)
- Service areas: one or more pin codes / localities
- Post **activities** (classes, workshops, camps) with:
  - Title, description, schedule, fees, age/grade range
  - Target curricula (optional multi-select)
  - Target pin codes or “city-wide”
- Analytics: views, saves, reminder counts (phase 2)

### 2.3 Platform (internal)

- Admin moderation, provider verification, abuse reports
- Not in v1 mobile UI; use Neon console + simple admin scripts initially

---

## 3. Circles Model

Circles are **not manually created chat rooms**. They are **computed membership groups** derived from parent profile data.

### 3.1 Circle Types

```
┌─────────────────────────────────────────────────────────────┐
│                        PARENT PROFILE                         │
│  Children: [IB MYP Grade 8, CBSE Grade 5]                     │
│  Pin code: 560102  │  Community: "Green Valley Apartments"   │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   CURRICULUM            LOCALITY            COMMUNITY
   circles               circle              circle
   ─────────             ─────────           ─────────
   CURR_IB_MYP           PIN_560102          COMM_green_valley
   CURR_CBSE             (all parents in    (parents who
   (one per curriculum   that pin code)      opted in same
   the parent has        regardless of       community name)
   children in)          curriculum)
```

| Type | Key | Membership rule |
|------|-----|-----------------|
| `curriculum` | `CURR_{code}` e.g. `CURR_IBDP`, `CURR_CBSE` | Parent has ≥1 child in that curriculum |
| `locality` | `PIN_{pincode}` | Parent’s pin code matches |
| `community` | `COMM_{normalized_name}` | Parent set same normalized community string |

A parent with two children (IB + CBSE) in pin 560102 at Green Valley is in **four circles**: `IB_*`, `CBSE_*`, `PIN_560102`, `COMM_green_valley_apartments`.

### 3.2 Circle UX

- **Home tabs or filters**: Curriculum | Near me (pin) | My community
- Tapping **IB** shows feed + member count for IB circle in user’s pin code (default scope)
- User can widen scope: “All IB parents in Bangalore” (city filter) — phase 2
- Member list shows **anonymous handle + child context** only, e.g.:
  - `Parent-7F2A · IB MYP · Grade 8`
  - Never: real name, phone, exact address

### 3.3 Posts in Circles

- Text, links, polls (phase 2)
- Tagged: `question`, `recommendation`, `heads_up`
- Scoped to one circle per post (cross-posting = phase 2)

---

## 4. Parent-to-Parent Communication

Parents can **post** and **communicate** with each other in three ways. All channels use **anonymous handles**—never real names, phone, or email.

### 4.1 Communication channels

```
                    ┌─────────────────────────────────────┐
                    │         SHARED CIRCLE MEMBERSHIP     │
                    │  (curriculum / pin / community)      │
                    └─────────────────────────────────────┘
                           │              │              │
                           ▼              ▼              ▼
                    CIRCLE POST     THREAD REPLY    DIRECT MESSAGE
                    (broadcast)     (on a post)     (1:1 chat)
                           │              │              │
                           └──────────────┴──────────────┘
                                    All anonymous
                              Parent-7F2A · context label
```

| Channel | Who sees it | Best for |
|---------|-------------|----------|
| **Circle post** | All members of that circle | General questions, recommendations, heads-ups |
| **Thread reply** | Circle members viewing that post | Follow-up on a specific topic |
| **Direct message** | Only the two parents in the conversation | Private coordination, sensitive topics, longer back-and-forth |

### 4.2 Circle posts

- Create from circle feed FAB or “New post” screen
- Tags: `question`, `recommendation`, `heads_up`, `general`
- Text + links (images = phase 2)
- Other parents can reply in thread or tap **Message** to open a DM with the author

### 4.3 Thread replies

- Nested under a `circle_post` (flat list v1; nested UI phase 2)
- Same anonymity rules as posts
- Push notification to post author on new reply (`circle_reply`)
- Rate limit: 30 replies/hour/parent

### 4.4 Direct messages (1:1)

**Eligibility:** Parent A can message Parent B only if they share **at least one circle** (any type). This keeps conversations within a trusted local/curriculum/community context.

**Starting a conversation:**

1. From **circle member list** → tap parent → “Message”
2. From **post or reply** → “Message parent”
3. API creates or returns existing `conversation` for the pair

**Conversation UI:**

- Chat screen like messaging apps: message bubbles, timestamps
- Header shows peer’s `anonymous_handle` + context (e.g. `Parent-3B9C · CBSE · G5`)
- Optional subtitle: “You’re both in PIN_560102” (circle context, not address)
- Pull-to-refresh or short poll for new messages (realtime in v2)

**Safety:**

- Block user → no new messages; existing conversation hidden
- Report conversation → moderation queue
- No phone/email sharing buttons v1 (discourage PII in chat; warn in UI)
- Rate limit: 50 messages/hour/parent

**Not in v1:** Group chats (3+ parents), parent–provider chat (use activity “interested” instead).

### 4.5 Communication UX in the app

| Screen | Path |
|--------|------|
| Messages inbox | `(parent)/messages/index` — all conversations, last preview |
| Chat | `(parent)/messages/[conversationId]` |
| New DM | From member list / post → creates conversation |
| Circle feed + thread | `(parent)/circles/[circleId]/` + `posts/[postId]` |

Tab bar: **Home | Circles | Messages | Activities | Profile**

---

## 5. Privacy & Anonymity

| Data | Parents see | Providers see |
|------|-------------|---------------|
| Parent real name | Self only | Never |
| Child name | Self only | Never |
| Anonymous handle | Everyone in circle | Never |
| Curriculum + grade | Circle members | Activity targeting only (aggregated) |
| Pin code | Locality circle members | Service area match |
| Community name | Community circle members | Never (unless parent shares in post) |
| Phone / email | Never in app | Never |

Implementation:

- On signup, generate `anonymous_handle` = `Parent-` + 4-char alphanumeric (unique)
- All circle UIs bind to `anonymous_handle` + `child_summaries` (curriculum/grade only)
- Row-level security (RLS) on Neon: users read circle posts only if `circle_members` row exists; DMs only if `conversation_participants` row exists

---

## 6. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Mobile | **React Native** (Expo recommended) | Single codebase iOS + Android, OTA updates |
| Navigation | Expo Router or React Navigation 6 | File-based routing with Expo |
| State | Zustand + React Query (TanStack Query) | Simple global state + server cache |
| API | **Node.js** (Hono or Fastify) on **Vercel** / Railway / Fly.io | Thin BFF; Neon serverless-friendly |
| Database | **Neon** (PostgreSQL 16) | Serverless Postgres, branching for dev |
| Auth | Neon Auth / Supabase Auth / Clerk | JWT; pick one with RN SDK |
| Realtime | Neon + polling initially; **Supabase Realtime** or **Ably** later | v1: pull-to-refresh + 60s poll on feeds |
| Push | **Expo Notifications** + FCM/APNs | Reminders & circle activity |
| File storage | Cloudflare R2 or S3 | Provider logos, activity images |
| Search | Postgres `tsvector` on activities | Enough for v1 |

### 5.1 High-Level System Diagram

```
┌──────────────┐     HTTPS/JWT      ┌──────────────┐
│ React Native │ ◄────────────────► │  API (BFF)   │
│  (Expo app)  │                    │  Hono/Fastify│
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ Expo Push                         │ SQL (pooled)
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│ FCM / APNs   │                    │   Neon DB    │
└──────────────┘                    │ PostgreSQL   │
                                    └──────────────┘
```

---

## 7. API Surface (REST, v1)

Base: `https://api.vaara.parents/v1`

### Auth
- `POST /auth/register` — role, email, password
- `POST /auth/login`
- `POST /auth/refresh`

### Parent profile
- `GET/PATCH /me`
- `GET/POST/PATCH/DELETE /me/children`
- `PATCH /me/location` — pin code, locality, community

### Circles (read-mostly; membership is computed)
- `GET /circles` — list circles for current user with member counts
- `GET /circles/:circleId/feed` — paginated posts
- `POST /circles/:circleId/posts`
- `GET /circles/:circleId/posts/:postId` — post + replies
- `POST /circles/:circleId/posts/:postId/replies`
- `GET /circles/:circleId/members` — anonymous list

### Parent messages (1:1, anonymous)
- `GET /conversations` — inbox (last message preview, unread count)
- `POST /conversations` — start or resume DM; body: `{ peerUserId, circleId? }` (validates shared circle)
- `GET /conversations/:id/messages` — paginated message history
- `POST /conversations/:id/messages` — send message
- `PATCH /conversations/:id/read` — mark read up to timestamp
- `POST /users/:id/block` — block parent (stops DMs)

### Activities (provider + parent read)
- `GET /activities?pin=560102&curriculum=CBSE` — discovery
- `GET /activities/:id`
- `POST /activities` — provider only
- `PATCH/DELETE /activities/:id` — provider only

### Reminders
- `GET/POST/DELETE /me/reminders`
- Links to `activity_id` or free-text note + `fire_at`

### Notifications
- `POST /me/push-token`
- `GET /me/notifications`

---

## 8. React Native App Structure

```
app/                          # Expo Router
  (auth)/
    login.tsx
    register.tsx
    onboarding/
      role-select.tsx
      parent-profile.tsx
      add-children.tsx
      location.tsx
  (parent)/
    index.tsx                 # Home: circle shortcuts
    circles/
      [circleId]/
        index.tsx             # Feed
        members.tsx
        new-post.tsx
        posts/
          [postId].tsx        # Thread + reply + "Message parent"
    messages/
      index.tsx               # Inbox
      [conversationId].tsx    # 1:1 chat
    activities/
      index.tsx               # Discover
      [id].tsx
    reminders/
      index.tsx
    profile/
      index.tsx
      children.tsx
      settings.tsx
  (provider)/
    index.tsx                 # Dashboard
    activities/
      index.tsx
      new.tsx
      [id]/edit.tsx
    profile.tsx

src/
  api/                        # React Query hooks + API client
  components/
    circles/
    messages/
    activities/
    common/
  stores/                     # Zustand (auth session, onboarding)
  constants/
    curricula.ts              # IBDP, CBSE grades enums
    pin-codes.ts              # optional seed
  hooks/
  utils/
    anonymity.ts
    circle-keys.ts
```

### Key screens (parent)

1. **Onboarding** — role → children (multi) → pin + community
2. **Home** — three circle chips (Curriculum / Locality / Community) + activity carousel
3. **Circle feed** — anonymous posts, FAB to post, open threads
4. **Messages** — inbox + 1:1 chat with other parents (anonymous)
5. **Activities** — filter by child’s curricula + pin code
6. **Reminders** — list + add from activity detail

### Key screens (provider)

1. **Onboarding** — org name, type, service pin codes
2. **Dashboard** — my activities, quick post
3. **Activity editor** — schedule, targeting

---

## 9. Curriculum & Grade Configuration

Store as **reference data** in DB (`curricula`, `curriculum_grades`) so you can add boards without app release.

Initial seed:

| Curriculum | Example grades |
|------------|----------------|
| IB PYP | K, G1–G5 |
| IB MYP | G6–G10 |
| IBDP | G11, G12 |
| CBSE | Nursery, LKG, UKG, G1–G12 |
| SSC (Telangana/AP) | G1–G10 |
| IGCSE | Y1–Y11 |

Child record: `curriculum_id` + `grade_id` (FKs).

---

## 10. Notifications & Reminders

### Reminders (user-initiated)

- Stored in `reminders` with `fire_at`, `user_id`, optional `activity_id`
- **Cron worker** (Vercel Cron / GitHub Actions / Inngest): every minute query `fire_at <= now() AND sent = false`
- Dispatch Expo push; mark `sent = true`

### Push notification types

| Type | Trigger |
|------|---------|
| `circle_post` | New post in joined circle (batched: max 1 per circle per hour) |
| `circle_reply` | Reply to your post |
| `direct_message` | New message in a 1:1 conversation |
| `activity_nearby` | New activity in your pin codes (opt-in) |
| `reminder` | Scheduled reminder fires |
| `provider_update` | Activity time/location change |

### In-app notification center

- Persist in `notifications` table; mark read on tap

---

## 11. Security

- JWT short-lived + refresh token rotation
- Neon **connection pooling** (PgBouncer) from API only—no direct DB from mobile
- RLS policies:
  - `circle_posts`: SELECT if user in `circle_members`
  - `direct_messages`: SELECT if user in `conversation_participants`
  - `children`: SELECT only `user_id = auth.uid()`
  - `activities`: SELECT public where pin in user’s pin or provider’s service area
- Rate limits on post creation (10/hour/parent) and DMs (50/hour/parent)
- Report post / block user (stores reporter + target handle, not PII leak)

---

## 12. Non-Goals (v1)

- Video calls, live classes
- Payments / bookings
- School ERP integration
- Cross-city circle discovery
- Group chats (3+ parents)
- Parent–provider direct messaging (use activity “interested” flag only)
- Hindi / regional language UI (English v1)

---

## 13. Related Documents

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Neon tables, indexes, RLS
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — phased delivery, milestones, estimates
