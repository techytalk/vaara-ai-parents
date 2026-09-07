# Post composer: cross-posting and interests

## Status

Implemented with a **shared-thread** model: one post can target multiple
circles; everyone in those circles participates in the same reply thread.
Guest users still cannot browse a non-member circle’s full feed or members
(for now — feed surfacing across circles can open later). Interest alias
search (item 10) is deferred.

Own-circle membership remains the relevancy priority for feeds; cross-circle
placements expand reach without cloning posts.

## User-reported problems

1. The composer does not clearly communicate how to post the same post into
   additional circles.
2. The label “Topics” does not match the user's mental model. “Interests” is
   clearer.
3. Interest search appears to support arbitrary searches, but it only filters a
   fixed catalog by the displayed name. Searching for “Wimbledon” therefore
   cannot find “Sports & fitness.”

## What the product currently does

### Cross-posting

The New Post screen fetches `api.getCircles()` and passes all returned circles
to `AudienceSheet`.

`GET /v1/circles` returns circles where the current user has a
`circle_members` row. Membership is refreshed from the user's profile before
the query runs. It does not return public or unrelated circles.

The selected circle is always included and locked. Up to four additional
circles can be selected, for a maximum of five target circles.

When publishing, the app sends:

```ts
targetCircleIds: additionalCircleIds
```

The API adds the original circle, removes duplicates, and verifies that the
author belongs to every target circle. This rule is intentional and must
remain:

> A user can post only to circles they belong to.

Cross-posting must not become a way to write into unrelated private school,
class, curriculum, community, or locality circles.

### What the screenshot shows

The screenshot contains:

- One locked primary circle:
  `Bowrampet · Hyderabad · CBSE · Grade 5`
- Four selectable additional circles:
  `CBSE · Grade 5`, `Slate the school`, `502032`, and `CBSE Parents`

The rows and checkboxes are technically selectable. The principal issue in
this state is discoverability and wording, not missing cross-post support.

The subtitle `1 of 5 circles` is ambiguous. It can be interpreted as “only one
of my five circles is visible,” while the implementation means “one target is
currently selected, and the maximum is five.”

If a circle the user expects is completely absent, that is a separate data
issue:

- The user may not belong to it.
- Their child, school, curriculum, grade, locality, or community profile may
  not generate that membership.
- Membership sync may need to run after the profile changes.

It should not be solved by returning circles the user cannot access.

### Interests (“Topics” internally)

The database and API call this concept `topics`:

- `topics`
- `topic_aliases`
- `post_topics`
- `topic_follows`
- `topic_requests`
- `topicSlugs`

Those internal names are established and do not need a migration. The
user-facing product can consistently call them **Interests**.

The composer currently downloads the active catalog and performs this local
search:

```ts
topic.name.toLowerCase().includes(query)
```

This only matches the displayed interest name. It does not search:

- aliases,
- descriptions,
- category names,
- post content,
- parent profiles,
- people or players.

The current seeded catalog contains `Sports & fitness`; it does not contain
`Tennis` or `Wimbledon`. Consequently, “Wimbledon” correctly returns no match
under the present implementation, but the UI does not explain this
restriction.

## Product terminology decision

Use **Interests** everywhere users see this feature.

Examples:

| Current copy | Proposed copy |
| --- | --- |
| Add topics | Add interests |
| Search topics | Search interests |
| No topics match your search | No interests match “…” |
| Interest topics | Interests |
| Topics are what you want to read about | Interests help you find and follow related posts |
| Topic digests | Interest updates |
| Topic feed | Interest feed |

Keep `topic`, `topics`, and `topicSlugs` in database schemas, API contracts,
analytics properties, and TypeScript identifiers for now. A cosmetic internal
rename would add risk without improving the user experience.

## Proposed cross-posting experience

## Unified cross-circle posting

### The CBSE-to-IB use case

Example:

- The user's child follows CBSE.
- The user wants to understand IB curriculum structure from IB parents.
- The user is not an IB circle member and must not be given access to the IB
  feed or member list.

This is a valid cross-circle post. The desired product is not limited to a
special school-question screen.

The normal post composer should let an authenticated parent search and select
eligible circles whether or not they are a member. This includes:

- school-class circles,
- grade circles,
- school circles,
- curriculum circles such as `IB Parents`,
- locality circles,
- community circles.

Membership determines the author's access level in each target:

- **Member target:** normal member post and normal circle access.
- **Non-member target:** guest post. The author can access their own resulting
  thread, but does not gain access to that circle's feed or members.

Interests are independent metadata. Selecting `Tennis`, `IB curriculum`, or
another interest helps categorize and discover the post; it does not choose
which circle receives it.

The current API restriction—every ordinary target must be a membership
circle—does not implement this requirement and must be replaced with explicit
per-target member/guest authorization. It must not be removed without adding
the guest controls described below.

### Existing support

Vaara already supports the guest-question permission model for schools:

```http
POST /v1/schools/:schoolId/questions
```

From a school profile, the user can select **Ask current parents**. The question
becomes a post in that school's circle. The asker can open their own thread and
read or write replies, but cannot open the school circle feed.

The current school implementation limits the user to three questions in a
rolling seven-day window. The generalized design below replaces that narrow
rule with five non-member circle placements per calendar day across all
eligible circle types.

The school feature is useful prior art, but it is not the intended final entry
point. Currently, a CBSE parent cannot select the broad `IB Parents` curriculum
circle from the normal composer because `GET /v1/circles` returns only
membership circles.

### Proposed UI

There is currently no control for choosing non-member circles.

Use one audience control in the existing New Post screen:

`Post to circles`

Opening it should show two clearly separated sections:

1. **My circles** — circles where the author is a member.
2. **Other circles** — searchable eligible circles where the post will be
   submitted as a guest.

Each row must show its access mode:

- `Member`
- `Guest · You can access only your post and replies`

Suggested flow:

1. Open the normal New Post composer.
2. Tap `Post to circles`.
3. Search all eligible circle types using safe display metadata.
4. Select member and/or guest destinations up to the placement limit.
5. Select up to three Interests independently.
6. Review a summary such as:
   `Posting to 3 circles · 1 member · 2 guest`.
7. Publish once.
8. Open each resulting thread from `Your Posts`.

For the CBSE-to-IB example:

1. Search `IB`.
2. Select `IB Parents`.
3. The row shows that this is a guest destination.
4. The composer explains:
   `IB Parents will see this post. You can follow its replies, but this does not
   give you access to the IB Parents feed or member list.`
5. Publish.

For the example, the resulting question might be:

`My child currently follows CBSE. How is the IB curriculum structured, and
what differences should parents expect when considering a switch?`

The current school-specific author label is:

`Prospective parent · Not in this circle`

For general cross-circle posting, use the broader label:

`Guest parent · Not in this circle`

“Prospective parent” is misleading when the post concerns sports, activities,
local services, or another non-school interest.

### Guest-post permissions

For every non-member target, the guest author may:

- view their own complete post thread,
- read member replies,
- reply in that thread,
- edit their post,
- delete their post,
- receive reply notifications and realtime updates.

The outsider author may not:

- open the target circle feed,
- list its members,
- create unrelated normal posts there,
- vote in its polls,
- mark posts helpful,
- use the post to browse any target circle outside their own thread.

If the author later becomes a member, normal member permissions take
precedence.

### Thread isolation requirement

The current multi-circle implementation stores one `circle_posts` row with
multiple `circle_post_targets`. Replies belong to the post, not to a target
circle. Reusing that shape for guest cross-posting would merge replies from
unrelated private circles into one thread.

Example of the privacy failure to avoid:

- A post targets the author's CBSE circle and the non-member IB circle.
- A CBSE parent replies.
- An IB parent opens the same post and sees the CBSE reply.
- The two private circle conversations have leaked into each other.

Therefore, publishing to multiple circles must create one isolated post/thread
per target circle. Link those copies with a private grouping identifier, for
example `cross_post_group_id`, for author management only.

The author sees one composer submission and a grouped entry in `Your Posts`;
each target circle sees only its own post copy and replies.

### API design

Add a cross-circle directory endpoint:

```http
GET /v1/circles/directory?q=ib&type=curriculum
```

It returns safe display metadata plus:

```json
{
  "id": "circle-id",
  "displayName": "IB Parents",
  "circleType": "curriculum",
  "accessMode": "guest",
  "acceptsGuestPosts": true
}
```

Use a grouped publishing endpoint rather than weakening the existing member
endpoint:

```http
POST /v1/cross-posts
```

Request:

```json
{
  "body": "How is the IB curriculum structured?",
  "tag": "question",
  "targetCircleIds": ["member-circle-id", "ib-circle-id"],
  "topicSlugs": ["ib-curriculum"]
}
```

Transaction steps:

1. Authenticate the author and sync their memberships.
2. Normalize and deduplicate target IDs.
3. Load every target and determine `member` or `guest` per target.
4. Reject targets that do not accept guest posts.
5. Enforce total-target and daily guest-placement limits.
6. Create a `cross_post_group` row.
7. Create a separate `circle_posts` row for each target.
8. Create exactly one target record for each post copy.
9. Store structured posting context (`member` or `guest`) per copy.
10. Copy media and interest associations safely to each post.
11. Emit notifications/realtime events separately for each circle.
12. Return the group ID and generated `{ circleId, postId, accessMode }`
    entries.

The existing school-question endpoint can call the same service with one
school-circle guest target. The existing member-only create endpoint can remain
for backwards compatibility.

Suggested schema:

```sql
CREATE TABLE cross_post_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circle_posts
  ADD COLUMN cross_post_group_id uuid
    REFERENCES cross_post_groups(id) ON DELETE SET NULL,
  ADD COLUMN posting_context text NOT NULL DEFAULT 'member',
  ADD CONSTRAINT circle_posts_posting_context_check
    CHECK (posting_context IN ('member', 'guest'));
```

If moderation is introduced, add a per-copy state such as
`pending`, `published`, or `rejected`; one circle's moderation result must not
block the other copies.

### Circle discoverability without privacy leakage

The selection screen may expose only safe directory fields:

- circle display name,
- broad circle type,
- curriculum,
- school name,
- broad city/area where appropriate,
- whether guest posts are accepted.

It must not expose:

- member names or anonymous handles,
- member count when that would reveal a very small group,
- feed previews,
- private activity,
- child information.

### Moderation and anti-spam

- Allow up to five **guest circle placements** per user per calendar day.
- The quota refreshes at the start of the next calendar day in the user's
  stored IANA timezone (for example `Asia/Kolkata`), not seven days after the
  first placement.
- Show the remaining quota before submission, for example:
  `3 of 5 guest circle posts remaining today`.
- Count destinations, not composer submissions. One submission to two
  non-member circles consumes two guest placements. Member targets do not
  consume this guest quota.
- Permit up to five total targets in one submission, subject to the remaining
  guest-placement quota.
- Prevent identical or near-identical posts from being sent repeatedly across
  successive submissions.
- Give members normal report/block controls.
- Allow circle administrators to disable guest posts.
- Consider first-time guest posts requiring moderation before delivery.
- Clearly show outsider status to members.

### Product wording

Use:

- `Post to circles`
- `My circles`
- `Other circles`
- `Guest`
- `Post to IB Parents`
- `You will only have access to your post and its replies`

Avoid:

- `Join conversation` when no membership is granted
- `Share with IB Parents`, because “share” is already used for external post
  links and is ambiguous

### Acceptance criteria

- A CBSE parent can find and select an eligible `IB Parents` curriculum circle
  from the normal audience selector.
- They can publish there without becoming a member.
- They can use up to five non-member circle placements per calendar day and the
  quota refreshes the next day.
- One submission may include member and non-member circles.
- Every target receives an isolated post/reply thread.
- IB members see the post in the IB circle feed with guest labelling.
- The author can open every generated thread from submission, notifications,
  and a grouped entry in `Your Posts`.
- The author can read and reply only within that thread.
- Opening the IB feed or member list remains denied.
- The existing member-only post endpoint still rejects non-member target IDs.
- Guest-placement limits and report/block behavior are enforced.

### Composer pill

Replace the ambiguous audience label with:

- Label: `Post to`
- Value with one circle: the primary circle name
- Value with additional circles: `<primary circle> +2`
- Accessibility label:
  `Posting to <primary circle> and 2 additional circles. Change circles.`

### Audience sheet

Use:

- Title: `Post to circles`
- Supporting copy:
  `Choose up to 5 circles. Guest posts do not give you access to a circle's feed or members.`
- Counter: `1 selected · up to 5 total`
- Primary row badge: `MEMBER` or `GUEST`
- Primary row helper: the applicable access explanation
- Section headings: `Selected`, `My circles`, and `Other circles`
- Search placeholder: `Search all circles`
- Empty state:
  `No eligible circles match your search.`

The entire row should remain tappable, not only the checkbox.

After selection:

- Change the checkbox immediately.
- Update the counter immediately.
- Show a small `Selected` section or place selected circles first.
- Preserve selections when the sheet is closed and reopened.
- When the maximum is reached, keep selected rows enabled so they can be
  removed and show:
  `Maximum selected. Remove one to choose another.`

### Circle search

Search all user-visible circle fields:

- display title,
- subtitle,
- school,
- grade,
- curriculum,
- locality/pin code,
- community.

Normalize case and whitespace.

Search `My circles` locally because the membership list is already loaded.
Search `Other circles` through the safe directory endpoint because non-member
circles are not returned by the existing `GET /v1/circles`.

### Editing an existing post

The current product intentionally locks target circles after publishing. The
edit screen should say:

`Posted to N circles · circles cannot be changed after publishing.`

Changing this rule later requires explicit API semantics for adding/removing
targets and deciding what happens to read state, notifications, moderation,
and visibility. It should not be mixed into this UI clarification.

## Proposed interest experience

### Composer entry point

Rename the toolbar action to `Add interests`.

The sheet should use:

- Title: `Add interests`
- Subtitle: `Choose up to 3 to help parents discover this post`
- Search placeholder: `Search interests, e.g. tennis or screen time`
- Selected counter: `2 selected · up to 3`

Show selected interests first as removable chips so users can confirm what will
be attached before pressing Done.

### Search behavior

The minimum acceptable search should match:

1. Interest name
2. Interest aliases
3. Category
4. Description

Ranking:

1. Exact name
2. Exact alias
3. Name prefix
4. Alias prefix
5. Name or alias substring
6. Category/description match

Normalize:

- lowercase,
- leading/trailing whitespace,
- repeated whitespace,
- punctuation,
- common singular/plural forms where an alias exists.

### Wimbledon example

“Wimbledon” is not itself a broad parenting interest. A useful mapping is:

- Canonical interest: `Tennis`
- Category: `Activities`
- Aliases: `wimbledon`, `tennis players`, `grand slam`, `racket sports`

Searching “Wimbledon” should therefore suggest `Tennis`.

If the user is looking for a specific Wimbledon player or another parent, that
is not an interest lookup. Vaara should not expose a global parent search
because circle identities are intentionally anonymous. Searching public people
or arbitrary post text would be a separate product feature.

### Catalog expansion

Add useful canonical interests rather than making every search phrase a new
interest. Initial sports expansion can include:

- Tennis
- Cricket
- Football
- Swimming
- Badminton
- Basketball
- Athletics
- Martial arts

Aliases should map event and colloquial terms to these canonical interests.
Examples:

- `wimbledon` → Tennis
- `ipl` → Cricket
- `soccer` → Football
- `karate` and `taekwondo` → Martial arts

The exact catalog should remain curated to prevent duplicates such as
`Football`, `Kids football`, and `Football classes`.

## API and data solution

### Recommended approach

Expose aliases in the interest catalog and keep search local for this release.
The list is small and already downloaded when the composer opens.

Extend each catalog item:

```ts
type InterestCatalogItem = {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  aliases: string[];
};
```

`GET /v1/topics` should aggregate active aliases for each canonical topic.
The mobile filter should search `name`, `category`, `description`, and
`aliases`.

Continue sending only the canonical `slug` in `topicSlugs`. The API already
resolves canonical slugs and aliases, but canonical slugs keep stored post
associations predictable.

### Future server search

If the catalog becomes large, add:

```http
GET /v1/topics/search?q=wimbledon&limit=20
```

Use indexed normalized names and aliases. Do not add this endpoint merely for
the current small catalog.

### Requesting a missing interest

The database already contains `topic_requests`, but no user-facing request flow
is currently exposed.

Add later:

```http
POST /v1/topics/requests
```

Request body:

```json
{
  "proposedName": "Chess tournaments",
  "rationale": "Useful for parents looking for local competitions"
}
```

The empty search state can offer:

`Can’t find it? Request an interest`

Requests must be moderated and merged into an existing canonical interest when
appropriate.

## Implementation phases

### Phase 1: database and policy

- Define which circle records accept guest posts. The requirement is to support
  every normal circle type, including school-class and curriculum circles.
- Add `cross_post_groups`.
- Add `cross_post_group_id` and `posting_context` to `circle_posts`.
- Add any per-circle `accepts_guest_posts` policy field.
- Add a user timezone field or another deterministic calendar-day boundary for
  the daily quota.
- Backfill existing posts as `posting_context = 'member'`.
- Register the migration in the migration runner.

### Phase 2: directory and publishing service

- Add the safe cross-circle directory query.
- Return `member` or `guest` for each result.
- Implement the five-per-day guest-placement check.
- Build one isolated post copy per target inside one transaction.
- Attach media, poll, and Interest records to every generated copy.
- Publish circle-specific realtime events and notifications.
- Return all generated thread IDs.
- Refactor the existing school-question endpoint to reuse this service.

The normal composer should preserve its existing post types:

- General
- Question
- Recommendation
- Heads up
- Poll
- Photo/video post

Guest capability affects access, not the post type.

### Phase 3: mobile audience selector

- Rename `Share with` to `Post to circles`.
- Replace the ambiguous `1 of 5 circles` copy.
- Add `Selected`, `My circles`, and `Other circles` sections.
- Search membership circles locally and other circles through the directory.
- Label every destination as Member or Guest.
- Show guest-access and remaining-quota notices before publishing.
- Submit through the grouped cross-post endpoint.
- Display one grouped result in `Your Posts` with access to each isolated
  thread.

### Phase 4: improve Interest terminology and search

- Add `Tennis` and other agreed canonical sports interests.
- Seed aliases such as `wimbledon` → `Tennis`.
- Rename all user-visible Topic copy to Interest.
- Return aliases from the catalog API.
- Search names, aliases, descriptions, and categories.
- Show selected interests as chips.

This needs a repeatable database migration or idempotent production data
operation. Editing only `seed.ts` will not update an existing production
database.

### Phase 5: missing-interest workflow

- Add the topic-request API.
- Add `Request an interest` UI.
- Add an administrative moderation path.

This can be deferred until search behavior and catalog gaps are measured.

## Acceptance criteria

### Cross-posting

- Opening `Post to circles` shows member circles and searchable eligible
  non-member circles.
- Selecting a row visibly checks it and updates the selected count.
- Every row clearly says Member or Guest.
- Closing and reopening the sheet preserves selection.
- The composer pill shows the number of additional circles.
- Publishing creates one isolated post/thread per selected circle under one
  cross-post group.
- Each generated post appears only in its selected circle feed.
- Replies from one target circle never appear in another target circle.
- A non-member circle may be selected only when it accepts guest posts.
- The author can access their own guest threads but cannot browse the guest
  target's feed or members.
- No more than five non-member placements are accepted per user calendar day.
- The maximum is five total circles.

### Interests

- All user-facing copy says Interests, not Topics.
- Searching `tennis` returns Tennis.
- Searching `Wimbledon` returns Tennis through an alias.
- Searching is case-insensitive.
- Selecting up to three interests updates the composer immediately.
- Published posts contain canonical interest slugs.
- Existing topic feeds and follows continue working without a schema rename.
- Searching for a person does not imply global parent discovery.

## Analytics

Track only interaction metadata, never search text:

- `post_circle_picker_opened`
- `post_cross_circle_selected` with `selected_count`
- `post_interest_picker_opened`
- `post_interest_selected` with canonical `interest_slug`
- `post_interest_search_no_results` without the raw query

Do not send circle names, school names, locality, search terms, post content, or
child information to Analytics.
