# Future: Pregnancy as a family type

**Status: parked.** Do not implement until school-parent traction is real.

Vaara’s current loop is **school → class → locality circles**. Pregnancy is a real adjacent audience, but it is a deeper product than an extra onboarding toggle: hospital connections, week-by-week guidance, and moderation for medical-adjacent advice. Ship school density first; return here after that.

This note captures the flow and product locks agreed in product discussion so the work is not redesigned from scratch later.

---

## Why not now

- Growth priority is **schools and class circles**, not a second identity.
- Expecting parents need more than a circle: local hospitals, trimester guidance, and careful handling of health talk.
- Mixing that into add-child now would dilute the school loop and add schema/feed work before the core rooms are full.

**Current product stays as-is:** sign-up still requires at least one child (school + curriculum + grade) and a location.

---

## What we have today (do not change)

Sign-up assumes a **school-age child**. Onboarding is incomplete until there is ≥1 child **and** a location.

```
INTRO SCENES
  welcome → school/class/locality → tutors → IB/IGCSE → community
                    |
                    v
            CREATE ACCOUNT
         parent  |  provider
                    |
         (parent path only)
                    v
        ┌───────────────────────┐
        │  STEP 1 — ADD CHILD   │   (at least 1 required)
        │  nickname *           │
        │  date of birth *      │
        │  school *             │
        │  gender               │
        │  curriculum + grade   │
        │  [Add another child]  │
        └───────────┬───────────┘
                    v
        ┌───────────────────────┐
        │  STEP 2 — LOCATION    │
        │  country, pin, city   │
        │  locality, community  │
        └───────────┬───────────┘
                    v
              HOME FEED
```

Circles are derived per unique child + location combo via `syncCircleMembership()`:

```
Child: CBSE · Grade 3 · Oakridge · PIN 500032 · Prestige Lakeside

        ┌─ school_class  Oakridge · CBSE · Grade 3     ← tightest
        ├─ class         CBSE · Grade 3
        ├─ school        Oakridge
        ├─ community     Prestige Lakeside
        ├─ locality      500032
        └─ curriculum    CBSE Parents                 ← widest
```

Home feed already has two phases (reuse this; do not invent a second feed):

1. **Primary** — posts from the viewer’s own circles (ranked `school_class` → `class` → `school` → `community` → `locality` → `curriculum`).
2. **Discovery** — posts from circles they are not in (same pin first, then same board).

Code: `apps/mobile/app/onboarding/children/`, `apps/mobile/app/onboarding/location.tsx`, `apps/api/src/services/circle-sync.ts`, `apps/api/src/services/feed.ts`.

---

## Intended later: pregnancy on the same add-family step

Treat **“I am pregnant”** as a second family profile, not a separate app. Same feed engine: **own expecting circles first**, other school/class posts still visible in discovery.

```
            CREATE ACCOUNT (parent)
                    |
                    v
        ┌───────────────────────────────────────────┐
        │  STEP 1 — YOUR FAMILY                     │
        │  ( A )  A child  (born, in school)        │
        │  ( B )  I am pregnant                     │
        │  You can add both.                        │
        └───────────────┬───────────────────────────┘
                        |
          ┌─────────────┴─────────────┐
          v                           v
   PATH A — CHILD              PATH B — PREGNANT
   nickname, DOB               weeks (exact, stored)
   school, board, grade        school skipped
          |                           |
          └─────────────┬─────────────┘
                        v
              STEP 2 — LOCATION (always)
                        v
                   HOME FEED
```

Example circles for Path B (18 weeks, PIN 500032, Prestige Lakeside):

```
        ┌─ expect_trimester  Expecting · 2nd trimester   ← tightest
        ├─ expect_local      Expecting parents · 500032
        ├─ community         Prestige Lakeside
        └─ expect            Expecting parents (wide)

        Not auto-joined: school / class / board
        Those posts still appear in DISCOVERY
```

```
PRIMARY (her circles, first)
  trimester → expecting × pin → community → expecting (wide)

DISCOVERY (still visible, lower)
  school / class / board posts from other parents
```

A parent with **a child and a pregnancy** sits in both circle sets; both rank in primary.

---

## Product locks (agreed, not built)

### 1. Trimester circles, store exact weeks

Do not create 40 week-numbered rooms. Use **three trimester circles** (1–12, 13–27, 28–40+). Persist **exact weeks** on the profile (like DOB vs grade) so the UI can show “week 18” and we can split later if density exists.

When she moves T2 → T3, leave the old room (same as grade promotion).

### 2. Pregnancy can skip school

School + curriculum + grade stay required only for a **born child**. A pregnant-only user finishes onboarding with **pregnancy + weeks + location**. Do not force a placeholder school.

```
Onboarding complete if:
  ( ≥1 child with school )  OR  ( active pregnancy + weeks )
  AND  location
```

### 3. Add both in the same onboarding

One account may have children **and** one active pregnancy. At least one of those is required. Multiple children remain allowed. One active pregnancy at a time (twins = still one pregnancy; a twins flag can come later). After birth, convert that pregnancy into a child profile without a new account.

---

## Extra depth to design before building

Not just circles. Sketch these before any migration:

- Hospital / maternity home discovery (local, reviewable — similar to schools)
- Trimester guidance vs peer posts (what is parent talk vs what needs a professional)
- Moderation for medical-adjacent advice
- Transition: pregnancy row → newborn/nursery child, then school circles
- Whether housing `community` is shared with school parents (yes in the sketch above)

---

## Implementation hints (when un-parked)

Reuse existing primitives from [Feature Implementation Plan](./FEATURE_IMPLEMENTATION_PLAN.md):

| Need | Use |
|------|-----|
| Membership | `syncCircleMembership()` — add expecting circle types |
| Feed ranking | `apps/api/src/services/feed.ts` `CIRCLE_TYPE` case order — put trimester above discovery |
| Author label | `buildAuthorView()` — do not denormalise |
| Complete flag | `evaluateOnboardingComplete()` — allow pregnancy-without-children |

Do not add a second posts table. Do not require school on Path B.

---

## Suggested un-park trigger

School-class and locality circles have enough overlapping parents that a feed feels occupied. Then design hospitals + guidance, then onboarding fork. Not before.
