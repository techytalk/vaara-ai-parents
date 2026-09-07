# Edit own circle posts

**Status: built (v1).** Author can edit text, tag, photos/video, topics, and a poll until the first vote. Feeds and the thread show **Edited**. Audience stays frozen.

This is the end-to-end spec for edit. v1 is what shipped. Later slices are listed so they are not designed by accident.

Related: create lives in `POST /v1/circles/:circleId/posts` and `apps/mobile/app/circles/[circleId]/new-post.tsx`. Delete lives in `DELETE /v1/circles/:circleId/posts/:postId`. Marketplace already has `PATCH /v1/listings/:id` — follow that ownership pattern, plus S3 cleanup from delete-post.

Ground rules from [Feature Implementation Plan](./FEATURE_IMPLEMENTATION_PLAN.md) still apply: reuse `circle_posts` / `circle_post_media`, never denormalise author labels, membership checks via `assertCircleMember`.

---

## 1. Why

Parents mistype a school name, attach the wrong photo, or want to add a picture after posting. Today they must delete the post and all comments, then recreate it. That is worse than a quiet, attributed edit.

Edit is **not** a way to change who saw the post, rewrite a poll after people have voted, or impersonate another parent.

---

## 2. Scope

### v1 (build this)

| Can change | Cannot change |
|------------|----------------|
| Body text | Poll after the first vote |
| Tag (`general`, `question`, `recommendation`, `heads_up`) | Target circles / audience |
| Photos and videos (add, remove, reorder, replace) | Adding a poll to a post that had none |
| Topics (same limits as create) | Removing a poll entirely |
| Poll question and options, **only while vote count is 0** | Comments / another parent's post |

Must also show an **Edited** mark so the thread stays honest.

### Later (do not build in v1)

- Change which circles the post is shared to
- Edit comments
- Add or remove a poll on an existing post
- Time window (e.g. only editable for 24 hours) — optional product lock later, not required for v1
- Push notification on edit — skip; feed invalidation is enough

---

## 3. Product rules

1. **Author only.** Same check as delete: `author_id === current user`. Anyone else gets 403. No moderator edit in v1.
2. **Must still be a post.** After save, the post must have at least one of: non-empty body, ≥1 media item, or an existing poll. Clearing text *and* all photos on a post that has no poll is 400.
3. **Media cap unchanged.** At most `MAX_POST_MEDIA` (4) attachments. Same type/size rules as create (`verifyUploadedMedia`).
4. **Poll: editable until the first vote, then locked.**
   - **0 votes:** author may change the question and the option list (same 2–6 unique options as create). Send the **full list of option labels** (same idea as photos: the list you send *is* the poll after save). Because nobody has voted, options can be replaced with new ids.
   - **1 or more votes:** poll question and options cannot change. A save that includes `poll` returns 400 with a clear message. Text, tag, photos, and topics can still be edited.
   - Check the vote count **inside the same database transaction** as the update (lock the poll row). If a vote lands while the author is saving, reject the poll change — do not rewrite options out from under a vote.
   - v1 does not add a poll to a post that never had one, and does not delete an existing poll.
5. **Audience frozen.** `targetCircleIds` is not accepted on PATCH. `circle_post_targets` stay as created.
6. **Edited is visible.** If body, tag, media, topics, or an unlocked poll changed, set `edited_at`. The UI shows “Edited” next to the timestamp. Do not show a full edit history in v1.
7. **Comments stay.** Edit does not delete replies, helpful marks, or saves.
8. **Discovery and saves.** The same post id remains. Saved items and reports keep pointing at it. Home feed and circle feeds must show the new body/media after cache invalidation.
9. **Privacy.** Child nicknames, real names, phone, and email still never appear on the post. Edit cannot widen who can read the post.

---

## 4. Parent flow

```
OWN POST (thread header)
  [ Edit ]  [ Delete ]  [ Save ]
       |
       v
EDIT COMPOSER  (same screen as New post, edit mode)
  preload: body, tag, topics, current media, poll (if any)
  locked:  audience chips (read-only summary)
  poll:    editable if 0 votes; read-only once anyone has voted
  change:  text, tag, photos; poll only while vote count is 0
       |
       v
  Save  → PATCH → invalidate feeds → back to thread
  Cancel → discard local changes
```

### Thread

- Own post: pencil **Edit** beside the existing trash **Delete**.
- Not own post: no Edit. Safety menu unchanged.
- Under the timestamp, if `editedAt` is set: `49m ago · Edited`.

### Composer in edit mode

Reuse `apps/mobile/app/circles/[circleId]/new-post.tsx` (route param `postId`) or a thin wrapper that loads the post then renders the same fields.

- Title: **Edit post**
- Primary action: **Save** (not Post)
- Existing images show from CDN URLs; parent can remove or add new local files
- New files use the existing upload-url → PUT S3 → `storageKey` path
- Kept files are sent as `{ id }` or `{ storageKey }` of rows that already belong to the post
- Audience sheet is visible but disabled, with helper copy: “Circles can’t be changed after posting.”
- If the post has a poll and `totalVotes === 0`: show the usual poll fields (question, options). Helper: “You can edit this poll until someone votes.”
- If the post has a poll and `totalVotes > 0`: show question and options read-only. Helper: “This poll already has votes, so the question and options can’t be changed.”

### Feed cards

`FeedPostCard` and the thread body read `editedAt` and render the Edited suffix. No extra menu on the card in v1 — edit is on the thread (one obvious place). Optional later: long-press / ⋯ on own cards in the feed.

---

## 5. Data model

`circle_posts` already has `updated_at` (bumped on new comments). That is **not** the Edited flag — comments would mark every post as edited.

Add a dedicated column:

```sql
-- 030_post_edited_at.sql
ALTER TABLE circle_posts
  ADD COLUMN edited_at timestamptz;
```

Register as version `030_post_edited_at` in `packages/db/src/migrate.ts`.

- `edited_at` null → never edited (or only comments happened)
- `edited_at` set → show Edited
- On a successful v1 PATCH that actually changes body, tag, media, topics, or an unlocked poll: `edited_at = now()` and `updated_at = now()`
- Do not set `edited_at` on no-op PATCH (400 “No changes provided” is fine)

No new table. Media stays in `circle_post_media`. Topics stay in `post_topics`.

---

## 6. API

### `PATCH /v1/circles/:circleId/posts/:postId`

Auth required. `:circleId` must be one of the post’s targets (same as GET/DELETE). Caller must be a member of that circle (so they can still open the thread) **and** the author.

Request (all fields optional; omitted = leave as-is):

```json
{
  "body": "Corrected: Oakridge has a proper sports block.",
  "tag": "question",
  "topicSlugs": ["admissions", "sports"],
  "media": [
    { "id": "existing-media-uuid" },
    {
      "storageKey": "posts/userId/new-file.jpg",
      "mediaType": "image",
      "mimeType": "image/jpeg",
      "width": 1200,
      "height": 800
    }
  ],
  "poll": {
    "question": "Best sports facilities nearby?",
    "options": ["Oakridge", "Meridian", "Not sure"]
  }
}
```

**Media array semantics (explicit replace):** if `media` is present, it is the **full new ordered list** (like putting a new set of attachments). Order in the array becomes `sort_order`.

- Item with `id` (or existing `storageKey` already on this post): keep that row
- Item with a new `storageKey`: `verifyUploadedMedia` then insert
- Rows on the post whose id/key are missing from the array: delete DB row and `deleteStoredMedia` for those keys
- If `media` is omitted: leave attachments unchanged
- If `media: []`: remove all attachments (only allowed if body or poll remains)

**Poll:** omit `poll` to leave it unchanged. If `poll` is present:

- No poll on the post → 400 (v1 does not add polls)
- Poll has ≥1 vote → 400 `"This poll already has votes and can't be changed"`
- Poll has 0 votes → update question; replace options with this **full list of labels** (2–6, unique, same validation as create). Old option rows are deleted; new rows are inserted. Safe because there are no votes to orphan.

Do **not** accept `targetCircleIds`.

Responses:

| Status | When |
|--------|------|
| 200 | Updated post JSON, same shape as GET post (`editedAt` included) |
| 400 | Empty post, invalid tag, too many media, invalid media, poll already has votes, invalid poll, targets in body |
| 401 | No auth |
| 403 | Not the author |
| 404 | Post not found, or not targeted at this circle |

Rate limit: reuse `postRateLimit` (same as create) so edit cannot be used to spam.

### Response field

Every post payload that already returns `createdAt` also returns:

```ts
editedAt: string | null;
```

Add to `CirclePost` / `HomeFeedPost` in `apps/mobile/src/lib/api.ts` and the API mapper used by feed, circle feed, thread, saved, and topics.

### Client helper

```ts
api.updatePost(token, circleId, postId, payload)
```

---

## 7. Server implementation notes

File: `apps/api/src/routes/circles.ts`, next to DELETE.

Suggested steps inside a transaction:

1. `assertCircleMember` + load post by id + target + `author_id`
2. 403 if not author
3. Validate tag / body / media like create. If `poll` is present, `validatePollInput` then `SELECT … FROM post_polls FOR UPDATE` and `COUNT(*)` on `poll_votes`. Reject if votes > 0.
4. If poll is unlocked and `poll` was sent: update `post_polls.question`; delete `poll_options` for that poll; insert the new labels in order.
5. If `media` provided:
   - Diff current `circle_post_media` vs incoming
   - Verify new keys
   - Delete dropped rows
   - Insert new rows
   - Update `sort_order` for kept rows
6. If `topicSlugs` provided: replace `post_topics` using existing `resolveTopicSlugs`
7. `UPDATE circle_posts SET body, tag, edited_at, updated_at`
8. Commit
9. After commit: `deleteStoredMedia` for dropped keys (same try/catch as DELETE — DB wins if S3 cleanup fails, log the error)
10. `invalidateCircleFeedCache` for every target circle (same as DELETE)
11. Return the mapped post (reuse GET-post mapping: media, poll, topics, author via `buildAuthorView`)

Realtime: v1 does **not** need a new `post.edited` event. Cache invalidation + pull-to-refresh / next page load is enough. Optional later: `post.updated` on the circle channel so open feeds replace the card without refresh.

Do not send a push for “parent edited their post.”

---

## 8. Mobile implementation notes

| Surface | Change |
|---------|--------|
| `circles/[circleId]/posts/[postId].tsx` | Edit in header for own posts; show Edited |
| `circles/[circleId]/new-post.tsx` | Edit mode when `postId` is in params; preload; Save → PATCH |
| `circles/_layout.tsx` | Title “Edit post” when editing |
| `FeedPostCard` | Edited suffix |
| `apps/mobile/src/lib/api.ts` | `editedAt`, `updatePost` |
| Home feed / circle list caches | After save, update or invalidate React Query keys the same way delete already does |

Composer preload:

- Existing media: `{ id, uri: cdnUrl, mediaType, ... }` so the thumbnail strip works without re-upload
- On save: kept items send `id`; new items upload first then send `storageKey`

If media storage is not configured (`mediaEnabled === false`), edit text/tag/topics only; hide add-photo in edit mode the same as create.

---

## 9. Feed and caches

`updated_at` must **not** bump the post to the top of the feed. Sort stays `created_at DESC` (current behaviour). An edited post keeps its original place.

Home feed SQL already selects `circle_posts` columns via the post row — add `edited_at` to those SELECTs so cards can show Edited without a second request.

Invalidate:

- circle feed cache per target (existing helper)
- any home-feed query keys on the client after a successful PATCH

---

## 10. Acceptance criteria

- [ ] Author can change text and tag on their post; thread and feed show the new text
- [ ] Author can add, remove, and reorder photos/videos up to 4; dropped files leave S3 (or are logged on cleanup failure)
- [ ] Author cannot edit another parent’s post (no control, API 403)
- [ ] Clearing all text and all media on a post with no poll is rejected
- [ ] With 0 votes, author can change poll question and options; votes stay at 0
- [ ] After the first vote, poll fields are read-only; a save that sends `poll` is rejected; text/photos can still be edited
- [ ] A vote that arrives during save cannot be orphaned (transaction + vote count check)
- [ ] Poll options and vote counts are unchanged when the author only edits text/photos on a poll that already has votes
- [ ] Circle list on the post is unchanged
- [ ] Comments, helpful, and saved still work on the same post id
- [ ] “Edited” appears after a real change, not after a no-op
- [ ] Post does not jump to the top of the feed solely because it was edited
- [ ] Discovery posts the viewer does not own still have no Edit control

---

## 11. Effort reminder

v1 as specified (text + images + poll-until-first-vote): about **3–5 days**. Text-only: **1–2 days**. Audience edit stays later.

---

## 12. ASCII: before vs after

```
TODAY
  create  →  post lives forever as written
  own     →  delete only
  others  →  report / save

V1
  create  →  post
  own     →  edit text/media/tag/topics  OR  delete
          →  poll editable only while 0 votes
          →  Edited mark
  others  →  report / save  (unchanged)
  poll    →  locked after first vote
  circles →  frozen
```
