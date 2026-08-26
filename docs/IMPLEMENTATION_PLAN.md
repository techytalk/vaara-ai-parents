# Vaara Parents — Implementation Plan

Phased delivery to ship a working parent community app, then provider activities, then polish. Estimates assume 1–2 engineers familiar with React Native + Node.

---

## Phase 0 — Foundation (Week 1)

**Goal:** Repo, Neon DB, API skeleton, Expo app shell.

| Task | Deliverable |
|------|-------------|
| Monorepo setup | `apps/mobile` (Expo), `apps/api` (Hono), `packages/db` |
| Neon project | Dev + prod branches; pooler URL in env |
| Run migrations | All tables from DATABASE_SCHEMA.md |
| Seed curricula/grades | SQL seed script |
| Auth | Register/login JWT; `anonymous_handle` generator |
| Mobile shell | Expo Router, auth gate, placeholder tabs |

**Exit criteria:** Parent can register, receive JWT, see empty home screen.

---

## Phase 1 — Parent Onboarding & Circles (Weeks 2–3)

**Goal:** Profile, children, location, automatic circle membership.

| Task | Deliverable |
|------|-------------|
| Children CRUD API | `/me/children` |
| Location API | `/me/location` with `community_key` normalization |
| Circle sync service | `syncCircleMembership(userId)` on profile changes |
| `GET /circles` | User’s circles + member counts |
| Onboarding UI | Multi-step: children (repeatable), pin + community |
| Home UI | Circle chips (curriculum / locality / community) |

**Circle sync logic (critical path):**

```
onChildChange / onLocationChange:
  1. Load children + location
  2. Build circle keys
  3. Upsert circles table
  4. DELETE FROM circle_members WHERE user_id AND circle_id NOT IN (...)
  5. INSERT circle_members ON CONFLICT DO NOTHING
```

**Exit criteria:** Parent completes onboarding; sees 3+ circles; member count updates when second test parent joins same pin.

---

## Phase 2 — Circle Feed, Threads & Direct Messages (Weeks 4–5)

**Goal:** Parents post in circles, reply in threads, and message each other 1:1—all anonymously.

| Task | Deliverable |
|------|-------------|
| Posts API | List/create posts; paginated cursor |
| Replies API | Thread on post (`GET/POST .../posts/:postId/replies`) |
| Member list API | Anonymous handles + curriculum/grade summary |
| **Conversations API** | `GET/POST /conversations`, shared-circle validation |
| **Messages API** | Send/list messages, mark read, block user |
| Feed UI | Post list, new post, thread screen, “Message parent” |
| **Messages UI** | Inbox tab + chat screen; start DM from member list |
| RLS / auth checks | Circle members for posts; conversation participants for DMs |

**Anonymous display helper:**

```ts
// Returns "Parent-7F2A · CBSE · G5" — pick primary child in that circle’s curriculum if type=curriculum
function formatCircleAuthor(user, circle, children): AuthorView
```

**Exit criteria:** Two parents in same PIN circle (a) exchange posts and replies, (b) start a DM from a post, without seeing each other’s real names.

---

## Phase 3 — Provider Role & Activities (Weeks 6–7)

**Goal:** Teachers/institutions publish activities; parents discover by location.

| Task | Deliverable |
|------|-------------|
| Provider onboarding | `provider_type`, org name, service pin codes |
| Activities CRUD | Draft/publish; pin codes + optional curricula |
| Discovery API | `GET /activities?pin=&curriculum=` |
| Provider app section | Separate tab stack after role select |
| Parent activities UI | List, filters, detail screen |
| Search trigger | `tsvector` update on title/description |

**Exit criteria:** Provider publishes workshop in pin 560102; parent with that pin sees it; parent in other pin does not.

---

## Phase 4 — Reminders & Notifications (Week 8)

**Goal:** Push reminders and circle activity alerts.

| Task | Deliverable |
|------|-------------|
| Expo Notifications setup | FCM + APNs credentials |
| `POST /me/push-token` | Store on user |
| Reminders CRUD | Link to activity or custom |
| Cron worker | Query pending reminders → Expo push |
| Circle post notifications | On new post, notify members (respect prefs, batch) |
| DM push notifications | On new direct message (`direct_message` type) |
| In-app notification list | `GET /me/notifications` |

**Cron options:**

- Vercel Cron → `POST /internal/cron/reminders` (protected secret)
- Or Inngest for retries

**Exit criteria:** Parent sets reminder for activity; receives push at `fire_at`; new circle post and new DM trigger push (if enabled).

---

## Phase 5 — Polish & Launch Prep (Week 9)

| Task | Deliverable |
|------|-------------|
| Report post / conversation flow | `reports` table + admin email |
| Error states / empty states | All main screens |
| App icons, splash | Store assets |
| EAS Build | Internal testing tracks |
| Privacy policy screen | Anonymity rules spelled out |
| Performance | Feed pagination, image lazy load |
| Logging | Structured logs on API (Axiom/Logtail) |

**Exit criteria:** TestFlight / Play internal build with full parent + provider flows.

---

## Monorepo Layout

```
vaara-ai-parents/
├── apps/
│   ├── mobile/                 # Expo React Native
│   │   ├── app/                # Expo Router routes
│   │   ├── src/
│   │   └── package.json
│   └── api/                    # Hono BFF
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   │   └── circle-sync.ts
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── db/
│   │   ├── migrations/
│   │   ├── seed/
│   │   └── schema.ts           # Drizzle
│   └── shared/
│       └── types.ts            # Shared TS types
├── docs/
├── package.json                # Turborepo or npm workspaces
└── turbo.json
```

---

## Key Implementation Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Expo vs bare RN | **Expo** (SDK 52+) | Push, OTA, faster iteration |
| API framework | **Hono** | Lightweight, edge-ready |
| ORM | **Drizzle** | Type-safe, good Neon support |
| Auth | **Clerk** or **custom JWT** | Clerk speeds RN social login; custom is cheaper |
| Circle membership | **Materialized** in `circle_members` | Fast feeds; sync on profile change |
| Realtime feeds | **Polling v1** | Avoids extra infra; add Supabase Realtime in v2 |
| Anonymous identity | **Server-generated handle** | Client cannot spoof |

---

## Circle UX Flow (Implementation Detail)

```
Home Screen
├── Section: "Your curricula"
│     └── [IB MYP] [CBSE]     → navigate to /circles/{id}
├── Section: "Near you"
│     └── [560102 - Indiranagar] → locality circle
├── Section: "Your community"
│     └── [Green Valley] or empty CTA if not set
└── Section: "Activities near you"
      └── horizontal scroll → /activities
```

**Curriculum circle scope (v1):** Members share curriculum code globally (all IB MYP parents in DB). **Optional v1.1 filter:** restrict member list default to same `pin_code` via UI filter without changing membership.

Recommendation for v1: **membership is global per curriculum**; **feed default filter** = same pin code (query joins `user_locations` for post authors). This keeps “IB parents near me” without fragmenting into thousands of `IB_PIN_560102` circles.

### Revised circle key strategy (recommended)

| Type | Key | Membership | Feed filter default |
|------|-----|------------|---------------------|
| curriculum | `CURR_CBSE` | all parents with CBSE child | same pin_code |
| locality | `PIN_560102` | all parents in pin | n/a |
| community | `COMM_green_valley` | same community_key | n/a |

Update `syncCircleMembership` and `DATABASE_SCHEMA` keys accordingly (`CURR_` prefix for curriculum).

---

## API ↔ Mobile Contract (React Query)

```ts
// packages/shared/types.ts
export type Circle = {
  id: string;
  circleType: 'curriculum' | 'locality' | 'community';
  displayName: string;
  memberCount: number;
};

export type CirclePost = {
  id: string;
  body: string;
  tag: string;
  author: {
    anonymousHandle: string;
    contextLabel: string; // "IB MYP · G8"
  };
  replyCount: number;
  createdAt: string;
};
```

Hooks: `useCircles()`, `useCircleFeed(circleId)`, `useCreatePost()`, `useConversations()`, `useMessages(conversationId)`, `useActivities(filters)`.

---

## Environment Variables

### API (`apps/api`)

```
DATABASE_URL=postgresql://...@ep-xxx-pooler.neon.tech/neondb
JWT_SECRET=...
CRON_SECRET=...
EXPO_ACCESS_TOKEN=...        # for push via Expo
```

### Mobile (`apps/mobile`)

```
EXPO_PUBLIC_API_URL=https://api...
```

---

## Testing Strategy

| Layer | Tool |
|-------|------|
| Circle sync | Unit tests with fixture users |
| API | Vitest + supertest against test Neon branch |
| Mobile | Maestro or Detox smoke: onboarding → post |
| E2E | Two simulators, same pin, verify anonymity |

---

## Post-v1 Backlog

- Curriculum circle feed filter: city-wide toggle
- Polls in posts
- Provider verification workflow
- Parent “interested” on activity (lead capture without DM)
- Regional language (i18n)
- Supabase Realtime for live feed
- Admin dashboard (Retool / custom)

---

## Milestone Checklist

- [ ] M0: Repo + Neon + auth
- [ ] M1: Onboarding + circles visible
- [ ] M2: Anonymous feed, threads, and 1:1 messages
- [ ] M3: Provider activities + discovery
- [ ] M4: Push reminders + notifications
- [ ] M5: Store internal build
