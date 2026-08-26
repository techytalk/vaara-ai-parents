# Vaara Parents

A React Native community app for parents—connect by **curriculum** (IBDP, CBSE, SSC, IGCSE, …), **locality** (pin code), and **apartment community**—without exposing real names. Teachers, trainers, and institutions share activities scoped to local areas.

## Tech stack

- **Mobile:** React Native (Expo)
- **API:** Node.js (Hono) BFF
- **Database:** Neon (PostgreSQL)
- **Push:** Expo Notifications

## Documentation

| Document | Contents |
|----------|----------|
| [Architecture](./docs/ARCHITECTURE.md) | Roles, circles model, privacy, API surface, app structure |
| [Database schema](./docs/DATABASE_SCHEMA.md) | Neon tables, indexes, RLS, discovery queries |
| [Implementation plan](./docs/IMPLEMENTATION_PLAN.md) | 8-week phased delivery, monorepo layout, milestones |

## Circles (core concept)

Parents are placed automatically into circles:

1. **Curriculum** — e.g. all CBSE parents (feed defaults to same pin code)
2. **Locality** — parents sharing a pin code
3. **Community** — parents in the same gated community / apartment name

Circle members see **anonymous handles** (e.g. `Parent-7F2A`) plus curriculum/grade context—not real names or child names. Parents can **post** in circles, **reply** in threads, and **message** each other directly (1:1).

## Getting started (upcoming)

Implementation follows the phased plan in `docs/IMPLEMENTATION_PLAN.md`.

### Phase 0 (done)

- Monorepo: `apps/mobile` (Expo), `apps/api` (Hono), `packages/db`
- Neon schema migrated + curricula seeded
- Auth: register / login with JWT and anonymous handles
- Parent onboarding: children, location, automatic circles
- Circle feeds, threaded replies, and anonymous 1:1 messages
- Provider activities: publish and discover by pin code
- Reminders, in-app notifications, and push (Expo) for circle posts, DMs, and scheduled reminders

### Quick start

```bash
# Install
npm install

# Database (requires .env.local with DATABASE_URL)
npm run db:migrate
npm run db:seed

# API (http://localhost:3000)
npm run dev:api

# Mobile (separate terminal)
npm run dev:mobile
```

Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `JWT_SECRET`.

