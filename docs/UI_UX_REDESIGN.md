# Vaara Mobile UI/UX Redesign

This document is the product, interaction, and visual specification for the
screenshot-inspired Vaara mobile redesign. It supplements `ARCHITECTURE.md` and
`BUSINESS_FUNCTIONALITY.md`; it does not change Vaara's privacy or membership
rules.

## Product promise

Vaara helps Indian parents find people and information relevant to their exact
schooling and local context without exposing family identities. Parents remain
anonymous in community spaces. Providers, schools, and experts are named so
that marketplace trust remains accountable.

The interface must make four ideas obvious:

1. **Private by default** — parent names, child names, and contact details are
   never presented in social feeds.
2. **Relevant by design** — circles are derived from school, class, curriculum,
   locality, and community instead of being manually created.
3. **Trusted discovery** — verification and reviews must be visible without
   implying trust signals that the API did not return.
4. **Safe coordination** — identity disclosure is explicit, contextual, and
   progressively requested.

## Information architecture

### Parent bottom navigation

| Tab | Purpose | Primary route |
| --- | --- | --- |
| Home | Personal overview, urgent updates, circle preview, discovery | `/(app)` |
| Circles | Complete grouped list of the parent's circles | `/(app)/circles` |
| Activities | Tutors, classes, camps, and institutions | `/(app)/activities` |
| Schools | School search, profiles, fees, and reviews | `/(app)/schools` |
| More | Messages, Market, saved content, utilities, and account | `/(app)/profile` |

Circle feeds remain in `/circles/[circleId]`, outside the tab navigator. This
keeps discussions immersive and preserves existing links.

### More hub destinations

Messages, Community Market, Notifications, Saved Posts, Topics, Calendar,
Experts, Reminders, Contact Details, Settings & Privacy, Help, and Sign Out.
Doctors, Playdates, and Carpool appear only when their feature flags are on.

### Provider navigation

Provider navigation remains Dashboard, Activities, and Profile. It receives
the shared visual system in a later phase but its routes and business flow are
not changed by the parent navigation redesign.

## First-run and authentication flow

1. Native launch screen uses Warm White with the Vaara mark.
2. A first-time signed-out user sees the welcome scene.
3. **Get Started** opens the four feature pages; **Log In** opens login.
4. Skip or completing the final feature page records a device-local flag and
   opens registration.
5. Returning signed-out users open login.
6. Authentication continues to server-backed child/location or provider
   onboarding when incomplete.
7. Authenticated users never see marketing onboarding during normal launch.

The local intro flag is not a profile or server-onboarding state.

## Visual system

### Core palette

| Token | Value | Use |
| --- | --- | --- |
| Midnight Navy | `#0D1B2A` | Main text, wordmark, dark brand surfaces |
| Deep Teal | `#0E9A8A` | Primary actions, active navigation, community |
| Coral | `#FF6F61` | Warm highlights and create actions |
| Amber | `#F5A623` | Ratings and limited attention cues |
| Lavender | `#A78BFA` | Secondary feature accents |
| Warm White | `#FFFCF7` | Main application background |

Amber uses the value visible in the reference palette. `#F5E90B` is not used
because it reads as neon yellow rather than amber.

Semantic surfaces use white cards, warm navy-tinted borders, soft teal/coral
backgrounds, and WCAG-compliant foregrounds. Color never carries meaning
without an icon or label.

### Typography

Plus Jakarta Sans is the brand typeface. The hierarchy is:

- Display: 30/38, bold
- Screen title: 24/31, bold
- Section title: 18/24, bold
- Body: 15/22, regular
- Supporting: 13/18, medium
- Caption: 11/15, semibold

System fonts are the startup fallback. Dynamic text may wrap; important content
must not be clipped to one line solely to reproduce the mockup.

### Layout

- 4-point spacing grid; common page gutter is 20.
- Minimum touch target is 44 by 44.
- Cards use 16–20 radius with restrained, warm shadows.
- Buttons use 14–16 radius; primary buttons are Deep Teal.
- Coral is reserved for creation and warm emphasis, not destructive actions.
- Content respects safe areas, keyboard avoidance, and large text.

### Artwork

Artwork is original and follows one consistent editorial style: rounded flat
shapes, diverse Indian families, Midnight Navy outlines, Warm White negative
space, and controlled Teal/Coral accents. No text is baked into illustrations.

Required assets:

- Vaara app mark and wordmark
- Family welcome scene
- School/class community scene
- Verified tutor card scene
- Trusted schools scene
- Community feature-grid scene
- App icon, adaptive foreground, and splash image

Source artwork should be retained at high resolution; screen exports should use
transparent PNG or scalable vector components and descriptive accessibility
labels only when the image conveys information.

## Component requirements

Shared primitives live under `apps/mobile/src/components/ui`.

| Component | Required states |
| --- | --- |
| Button | primary, secondary, ghost, loading, pressed, disabled |
| Card | default, interactive, selected, subdued |
| Chip | default, selected, count, disabled |
| Avatar | image, initials, anonymous handle color |
| Search field | empty, focused, populated, disabled |
| Badge | neutral, question, recommendation, heads-up, verified |
| Empty state | icon/illustration, title, guidance, optional action |
| Error state | recoverable copy and retry |
| Skeleton | card/list placeholders without fake content |
| Screen shell | safe area, background, scrolling and keyboard variants |

All interactive controls require a role, clear accessibility label, pressed
feedback, and no icon-only ambiguity.

## Phase 1 screen specifications

### Welcome and feature onboarding

- Full-height editorial composition matching the reference hierarchy.
- Skip is always available and does not imply account creation.
- Progress dots announce the current page.
- Swipe and explicit next controls lead to identical state.
- Small devices may scroll vertically; actions remain reachable.

### Home

- Greeting uses the anonymous handle returned by the API.
- Header exposes notifications and its real unread count.
- “My Circles” previews the most specific/relevant memberships first:
  school-class, class, school, community, locality, curriculum.
- “See all” opens the Circles tab.
- A privacy callout reinforces that parent identity is protected.
- Discovery shortcuts use real routes and feature flags.
- Calendar and followed-topic content appears only when returned by the API.

States:

- Loading: structural skeleton.
- No children: explain that child details create school/class circles.
- No location: prompt for pin code/community.
- No memberships: explain circle creation and offer profile completion.
- API failure: compact recoverable error with retry.

### Circles overview

- Group circles by relevance and type.
- Each item shows type, display name, real member count, and new-content count
  only when available.
- Profile-completion prompts are visually distinct from real circles.
- Tapping a circle opens the existing full-screen feed path.

### Circle feed

- Branded header shows circle title, member count, mute state, and access to
  members.
- Feed/Members/About controls are navigation affordances; they do not invent
  data unsupported by the API.
- Compose card and Coral create action open New Post.
- Post cards retain anonymous author handle/context, tag, body, poll, media,
  reply count, save state, and timestamp.
- Real-time invalidation, pull to refresh, mute, saves, and poll voting remain
  intact.
- Thread, member list, and composer use the same tokens and components.

## Later-phase screen requirements

### Phase 2: Activities and Schools

Use trust-first cards with verification, rating, curriculum/grade, price, and
distance only when those values exist. School cards separate parent-reported
fees from school-owned facts. Search and filters remain usable with keyboards
and screen readers.

### Phase 3: Messages, Market, More, Profile

Messages show unread state and context without revealing parent identity.
Market distinguishes sale/free/wanted and preserves disclosure before
handover. More acts as a scannable utility hub; Profile remains an account
destination rather than a bottom tab.

### Phase 4: Retention and coordination

Topics, Calendar, Experts, Notifications, Reminders, Saved Posts, and
disclosure prompts adopt the common system. Immediate notifications and
digests remain visually distinct.

### Phase 5: Flagged safety features

Practitioners, Playdates, and Carpool are redesigned before their flags are
enabled. Playdates never expose dates of birth. Carpool clearly communicates
Level 3 disclosure before confirmation.

## Content rules

- Write plain, reassuring, action-oriented copy.
- Prefer “parents in your circle” over growth-oriented social language.
- Never display a child's name in a circle.
- Never call a provider verified unless verification data is true.
- Never fabricate ratings, review counts, unread counts, member counts, fees,
  locations, or upcoming events to fill a layout.
- Empty states explain how real content will appear.

## Analytics-ready interaction names

The UI should be ready for, but not require, an analytics SDK:

- `intro_started`, `intro_skipped`, `intro_completed`
- `home_circle_opened`, `circles_view_all`
- `circle_post_started`, `circle_post_opened`, `circle_post_saved`
- `circle_poll_voted`, `circle_members_opened`
- `home_shortcut_opened`, `notification_center_opened`
- `more_destination_opened`

No personally identifying or child data belongs in event properties.

## Accessibility and responsive acceptance

- Text and controls meet WCAG AA contrast.
- Every touch target is at least 44 points.
- Screen-reader order follows visual reading order.
- Decorative images are hidden from accessibility.
- Controls do not rely on color alone.
- Layout works at 320-point width, common modern phones, and large text.
- Keyboard input never covers the active field or primary action.
- Loading, empty, error, offline, disabled, and pressed states are represented.

## Implementation phases and status

- Phase 1: design system, artwork, welcome/auth foundation, parent navigation,
  Home, Circles overview, Circle Feed and connected circle screens.
- Phase 2: Activities and Schools.
- Phase 3: Messages, Marketplace, More hub and Profile.
- Phase 4: topics, calendar, experts, notifications, reminders, saved posts,
  and disclosure.
- Phase 5: practitioners, playdates and carpool.

## Verification

Phase 1 requires:

- TypeScript checking for the mobile workspace.
- IDE diagnostic review for changed files.
- Expo export/build smoke test.
- Manual first-run, returning signed-out, incomplete parent onboarding,
  completed parent, and provider routing checks.
- Manual tab order, deep-link, notification route, safe-area, keyboard, text
  scaling, and iOS/Android checks.

The repository currently has no mobile unit or end-to-end suite. Backend stack
verification does not replace the manual mobile checks above.

## Phase 1 implementation record

Completed:

- Semantic palette, spacing, radius, typography, elevation, and avatar tokens.
- Plus Jakarta Sans startup loading.
- Shared screen, button, card, chip, avatar, search, error, empty, loader, and
  section primitives.
- Vaara mark/wordmark component and native icon/splash configuration.
- Five-scene pre-auth welcome experience with a device-local completion flag.
- Restyled login, registration, Google sign-in, and onboarding primitives.
- Home, Circles, Activities, Schools, More parent navigation.
- Home dashboard, grouped Circles overview, More hub, and Circle Feed.
- Shared circle styling inherited by thread, members, polls, media, and post
  composition.

Asset inventory under `apps/mobile/assets`:

- `icon.png`, `adaptive-icon.png`, `splash-icon.png`
- `illustrations/family-welcome.png`
- `illustrations/school-community.png`
- `illustrations/verified-tutor.png`
- `illustrations/trusted-schools.png`

Known intentional deviations from the AI concept:

- Real API content replaces all decorative ratings, review counts, member
  counts, unread counts, and school/provider names shown in the concept.
- Messages and Market remain at their existing routes but live under More,
  matching the selected five-tab structure without breaking links.
- Circle detail remains outside the tab navigator to preserve focused
  discussion and current notification links.
- The community onboarding page uses accessible native icon cards rather than
  a baked-in screenshot, allowing localization and text scaling.
- The original concept artwork was used only as direction. Production artwork
  is original and contains no embedded labels.

Verification completed:

- Mobile TypeScript check passes.
- IDE diagnostics report no errors in changed mobile files.
- Android Expo production export bundles successfully when the workspace app
  path is passed explicitly.

Still required before a store release:

- Physical-device visual review on at least one iPhone and Android phone.
- VoiceOver/TalkBack pass and large-text review.
- Product review of final illustration exports and app-icon crop.
- Phase 2–5 screen redesign work listed above.
