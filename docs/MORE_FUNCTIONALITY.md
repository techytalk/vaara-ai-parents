# More screen completion

## Purpose

The More tab is the account and utility hub for parents. It should remain
scannable and route to focused screens rather than expanding large settings
forms inline.

## Current implementation

The existing More screen already provides:

- anonymous parent profile and child curriculum/grade summary;
- real Circles and Saved counts;
- navigation to children, circles, saved posts, listings, messages, and
  notifications;
- location, contact details, topics, and calendar destinations;
- notification preference toggles and quiet-hours enablement;
- sign out.

The remaining gaps are:

- the third statistic is hard-coded as `— Upvotes`;
- Help & Support is an alert containing an email address;
- privacy and notification settings expand inline on the More screen.

## Product decision: Helpful, not Upvotes

The third profile statistic will be **Helpful received**.

Regular parent posts use the Helpful interaction. Upvotes belong to expert
session questions and are not a general parent-profile reputation metric.
Helpful received must count marks on posts authored by the signed-in parent,
excluding marks made by that same parent.

This number is informational only. It must not unlock permissions, rank parents,
or weaken anonymous identity.

## API: account statistics

Add:

```text
GET /v1/me/stats
```

Response:

```json
{
  "circleCount": 4,
  "savedPostCount": 8,
  "helpfulReceivedCount": 23
}
```

The endpoint derives all values for the authenticated user:

- `circleCount`: count of rows in `circle_members`;
- `savedPostCount`: count of `saved_items` where `item_type = 'post'`;
- `helpfulReceivedCount`: count of `post_helpful_marks` joined to
  `circle_posts` authored by the user, excluding the user's own marks.

The counts should be computed in one database round trip. No new table or
migration is required because the underlying tables already exist.

## Mobile API contract

Add a `MeStats` type and `api.getMeStats(token)` to
`apps/mobile/src/lib/api.ts`.

The More screen should load profile, children, stats, and any small navigation
badges together. It should no longer fetch complete circle and saved-post lists
only to calculate their lengths.

If stats fail while the profile succeeds, display `—` only for the unavailable
stat and keep the rest of More usable.

## More hub

Refactor `apps/mobile/app/(app)/profile.tsx` so it contains:

- profile card;
- Circles, Saved, and Helpful received statistics;
- primary account/navigation destinations;
- dedicated rows for Settings & Privacy, Notification Preferences, and Help &
  Support;
- sign out.

Remove inline privacy links and notification switches from this screen.

## Settings & Privacy screen

Create:

```text
apps/mobile/app/(app)/settings/index.tsx
```

This screen links to:

- My Children;
- Location & community;
- Contact details for mutual handover disclosure;
- Interest topics;
- School calendar;
- enabled safety features such as Playdates or Carpool.

It must explain:

- parent identity remains anonymous in circles;
- contact details are shared only through mutual, conversation-scoped
  disclosure;
- child identity is never disclosed;
- blocking prevents future contact without deleting moderation or disclosure
  audit records.

This is a navigation and explanation screen. It does not duplicate the child,
location, or contact-detail forms.

## Notification Preferences screen

Create:

```text
apps/mobile/app/(app)/settings/notifications.tsx
```

Use the existing notification preference API. The screen includes:

- Circle posts;
- Replies to your posts;
- Direct messages and parent connection requests;
- Reminders;
- Nearby activities;
- Topic digests;
- Marketplace;
- Identity sharing;
- Carpool updates;
- School calendar;
- Expert sessions;
- Quiet hours.

Requirements:

- optimistic switches with rollback and visible error feedback;
- pull-to-refresh or retry after load failure;
- save each change through the existing API;
- explain which notifications are immediate and which are digested;
- preserve the existing quiet-hours start/end values when enabling or
  disabling quiet hours.

Editing quiet-hours times can remain a later enhancement unless a suitable
time-picker interaction is added.

## Help & Support screen

Create:

```text
apps/mobile/app/(app)/support.tsx
```

The screen provides:

- account-help email action using `mailto:support@vaara.ai`;
- privacy and safety guidance;
- links to notification and privacy settings;
- guidance for reporting or blocking a parent from a request or conversation;
- concise frequently asked questions;
- app version information;
- a clear note that Vaara is not an emergency service.

The email action should include the app version and platform in the email body,
but must not automatically include child data, message contents, access tokens,
or other sensitive information.

No support-ticket database or API is required for this release.

## Navigation

Register hidden stack/tab routes for:

- `settings`;
- `settings/notifications`;
- `support`.

The More tab remains the only bottom-navigation entry for these destinations.
Back navigation must return to More.

## Files to change

Backend:

- `apps/api/src/routes/me.ts` — account statistics endpoint.

Mobile:

- `apps/mobile/src/lib/api.ts` — `MeStats` and client method;
- `apps/mobile/app/(app)/profile.tsx` — hub refactor and real stats;
- `apps/mobile/app/(app)/settings/index.tsx` — privacy/settings hub;
- `apps/mobile/app/(app)/settings/notifications.tsx` — preferences;
- `apps/mobile/app/(app)/settings/_layout.tsx` — settings stack;
- `apps/mobile/app/(app)/support.tsx` — support screen;
- `apps/mobile/app/(app)/_layout.tsx` — hidden route registration.

Documentation:

- update architecture/database documentation only if the statistics API
  contract is catalogued there.

## Verification

Backend checks:

- counts are scoped to the authenticated user;
- own Helpful marks do not increase Helpful received;
- users with no circles, saves, or Helpful marks receive zeros;
- deleted posts and cascading Helpful marks do not leave stale counts.

Mobile checks:

- all three statistics show real values;
- partial stats failure does not block More;
- each More destination opens the correct focused screen;
- notification switches persist and roll back on failure;
- support email opens with non-sensitive diagnostic metadata;
- sign out remains available;
- screen-reader labels and touch targets remain usable.

## Rollout

No database migration is needed. Deploy the API endpoint first, then deploy the
mobile screens. Older mobile builds remain compatible because the endpoint is
additive.
