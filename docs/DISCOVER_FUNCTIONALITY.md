# Discover functionality

Discover helps parents find published tutors, coaching, classes, and arts
activities available in their pin code and relevant to their children's
curricula.

## Data model

`activities.category` is the source of truth for activity classification:

- `tutoring`
- `coaching`
- `classes`
- `arts`
- `sports`
- `other`

Migration `024_activity_categories.sql` adds the column and a partial index for
published discovery queries. Existing teacher and trainer activities are
backfilled as tutoring and coaching. Existing institution activities use a
one-time keyword backfill for arts; all other institution activities become
classes. New and edited activities must use an explicit category selected by
the provider.

## Discovery API

`GET /v1/activities` continues to enforce:

- authenticated parent access;
- the parent's pin code, unless an explicit pin code is supplied;
- published status;
- curriculum relevance;
- optional verified-only and sorting rules.

It additionally accepts:

- `providerType=teacher|trainer|institution`;
- `category=tutoring|coaching|classes|arts|sports|other`.

Filters are applied by Postgres before the result limit. The mobile filters map
as follows:

| Mobile filter | API filter |
| --- | --- |
| Tutors | `providerType=teacher` |
| Coaching | `providerType=trainer` |
| Classes | `category=classes` |
| Arts | `category=arts` |

Search uses the existing indexed `activities.search_vector` and is combined
with the selected server-side filter.

## Mobile behavior

- Search is debounced by 300 ms, so typing updates results without issuing a
  request for every keystroke.
- Submitting the keyboard search applies the current text immediately.
- Selecting a filter refetches from the API; results are not filtered from a
  truncated client-side list.
- Featured tutors are shown on the All view.
- “See all” switches to the Tutors view, which renders the complete tutors
  result as a vertical list.
- Loading, refresh, empty, rating, verification, detail, reviews, and reminders
  continue to use real API data.

## Rollout

1. Apply migration `024_activity_categories.sql` before deploying the API.
2. Deploy the API so provider writes and discovery reads understand category.
3. Deploy the mobile update.
4. Providers should review the automatically backfilled category when editing
   an older activity.
