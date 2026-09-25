# App Store Guideline 1.2 — block, report, and terms

Submission `2e1a1b83-0c72-4863-a583-34c1df4c3abb` (version 1.0, build 1) was rejected on an iPad Air 11-inch (M3). Parents can post, comment, and message. Apple requires a block that notifies Vaara and removes that parent’s posts from the blocker’s feed immediately, plus a recording of the terms, the report flow, and the block flow.

This document is the spec. Do not change behavior beyond what is listed here.

## What already works

| Surface | Report | Block | Feed hides the blocked parent |
| --- | --- | --- | --- |
| Post ⋯ menu (`apps/mobile/app/circles/[circleId]/posts/[postId].tsx`) | Yes. Report post and Report parent. | No | No. Opening the post still shows it. |
| Circle feed (`apps/mobile/app/circles/[circleId]/index.tsx`) | No control on the card | No | No |
| Messages, connection requests | Yes | Yes | Chat is hidden. Circle posts stay. |
| Carpool and playdates (`apps/mobile/src/lib/parent-safety.ts`) | Yes | Yes | Those lists hide the parent. Circle posts stay. |
| Comments on one post | — | — | Yes. Reply query in `apps/api/src/routes/circles.ts` already excludes `user_blocks`. |

`POST /v1/me/blocks/:userId` in `apps/api/src/routes/me.ts` writes `user_blocks`, hides the direct conversation, and cancels a pending connection request. It does not write a `reports` row and does not email anyone.

Login and register show `LegalFooter`: “By continuing, you agree to our Privacy Policy and Community Guidelines.” That line does not say Terms of Use, and it does not say there is no tolerance for objectionable content.

The composer hint in `apps/mobile/app/circles/[circleId]/new-post.tsx` already says parents can report or block from the ⋯ menu. The post menu does not offer block. This change makes that sentence true.

## 1. Terms of Use before login and signup

Show the agreement on the first screen, above the Apple, Google, and email buttons, on both `apps/mobile/app/(auth)/login.tsx` and `apps/mobile/app/(auth)/register.tsx`. The review device is an iPad. The sentence has to be on screen without scrolling.

Visible copy, in `apps/mobile/src/components/LegalFooter.tsx`:

> By continuing, you agree to the Terms of Use. Vaara has no tolerance for objectionable content or abusive users. We remove that content and may remove the account.

Link the words “Terms of Use” to a new URL in `apps/mobile/src/constants/legal.ts`:

```ts
termsOfUse: "https://vaara.ai/terms.html",
```

Keep the existing Privacy Policy and Community Guidelines links on the same block, after that sentence.

The terms page (hosted with the other legal pages, not in this repo) must say the same thing in plain language: no tolerance for objectionable content or abusive users, parents can report and block, and Vaara removes the content and may remove the account. Put that same URL in App Store Connect as the custom license agreement.

Social and email sign-in stay available. The agreement is the text above those buttons, not a second screen and not a checkbox.

## 2. Block on the post and on the circle feed

One safety sheet, used everywhere a parent sees someone else’s post.

Add `apps/mobile/src/lib/post-safety.ts` with `showPostSafetyActions({ circleId, postId, authorId, handle, onBlocked })`. The sheet is the current Alert in the post screen, plus **Block parent**:

- Report post → existing `api.reportPost`
- Report parent → existing `api.reportUser`
- Block parent → `api.blockUser`, then the instant feed update in section 4

Wire it in two places:

- `apps/mobile/app/circles/[circleId]/posts/[postId].tsx` — replace the local `showPostSafetyActions`. The ⋯ button stays in the header for someone else’s post.
- `apps/mobile/app/circles/[circleId]/index.tsx` — on each card that is not the viewer’s post, add a ⋯ button that opens the same sheet. The circle list is the feed a reviewer sees. `FeedPostCard` is unused; do not build the new control only there.

After a successful block, show:

> Blocked. Their posts are removed from your feed. We’ll review this.

Messages, carpool, and playdates already call `api.blockUser`. Leave those buttons as they are. The API change in section 3 covers the developer email for every block, including those.

Extend `api.blockUser` in `apps/mobile/src/lib/api.ts` so a post block can send context:

```ts
blockUser: (token, userId, body?: { postId?: string; circleId?: string }) =>
  POST /v1/me/blocks/:userId
```

Callers that already block without a post keep working with no body.

## 3. Block notifies Vaara

In `POST /v1/me/blocks/:userId` (`apps/api/src/routes/me.ts`):

1. Keep the current checks and the current writes (`user_blocks`, hide conversation, cancel connection request).
2. Accept optional `postId` and `circleId`. If `postId` is set, load that post and require `author_id` to equal the blocked user. If it does not, ignore the post id and still block.
3. When the `user_blocks` insert is new (`INSERT ... ON CONFLICT DO NOTHING RETURNING blocker_id`), write one report and send one email.
4. Report row, same table reports already use:

```sql
INSERT INTO reports (reporter_id, target_user_id, target_post_id, reason)
VALUES ($blocker, $blocked, $postIdOrNull, $reason)
```

Reason text: `Blocked parent` plus the optional post id. `target_post_id` may be null when the block came from Messages, carpool, or playdates. That still satisfies `reports_one_content_target` (zero content targets is allowed; the check is `<= 1`).

5. Email `support@vaara.ai` from a new helper `apps/api/src/lib/safety-alert.ts`.

There is no mail sender in the API today. Send with Resend’s HTTP API when `RESEND_API_KEY` is set. From address: `SAFETY_ALERT_FROM` (default `Raj <Raj@vaara.ai>`). To address: `SAFETY_ALERT_EMAIL` (default `support@vaara.ai`). Resend must be allowed to send as `@vaara.ai`; the key sends as that address, it does not log into the mailbox. Subject: `Vaara safety: parent blocked`. Body: blocker id, blocked id, anonymous handles, post id, and the first 280 characters of the post when a post was included.

If the key is missing, log `[safety-alert] email skipped` and still return `{ ok: true }`. The report row is the durable record. Set `RESEND_API_KEY` in production before the next App Store submission so the email actually goes out.

A repeat block (`ON CONFLICT DO NOTHING` with no returning row) does not insert another report and does not send another email.

## 4. Blocked parent’s posts leave the feed immediately

Hiding is only for the parent who blocked. Do not delete the post, and do not hide it from other parents.

### API

Exclude posts whose author is in `user_blocks` for this viewer, in both directions, matching comments and chat:

```sql
AND NOT EXISTS (
  SELECT 1 FROM user_blocks b
  WHERE (b.blocker_id = $viewer AND b.blocked_id = p.author_id)
     OR (b.blocker_id = p.author_id AND b.blocked_id = $viewer)
)
```

Add that predicate everywhere a parent can be shown another parent’s post:

| Query | File |
| --- | --- |
| `loadCircleFeed` | `apps/api/src/services/feed.ts` |
| `MEMBER_HOME_FEED_SQL` | same file |
| `DISCOVERY_HOME_FEED_SQL` | same file |
| `loadHomeFeedFromTimeline` preview rows | `apps/api/src/services/feed-timeline.ts` |
| `loadCircleFeedFromTimeline` after hydrate | same file. Filter `visible` before `slice`. |

`loadCircleFeed` builds SQL with `$1` = circle id, and the viewer id is not always bound. Bind the viewer id and use it in the predicate. Home-feed SQL already uses `$1` as the viewer.

On the post thread (`GET` post in `apps/api/src/routes/circles.ts`): if the viewer has a block either way with `post.author_id`, respond `404` with `Post not found`. Replies are already filtered.

### App

Add `removeAuthorFromFeeds(queryClient, authorId)` next to `removePostFromFeeds` in `apps/mobile/src/lib/post-cache.ts`. It filters `authorId` out of the cached `["circleFeed", circleId]` list and the `["homeFeed"]` pages. Call it as soon as `blockUser` resolves, before the success alert, from `showPostSafetyActions`. That is the instant removal Apple asked to see on the circle list: pop back to the circle if the block happened on the post screen (`router.back()`), and the card is already gone.

Also drop that author from any circle feed cache whose key starts with `circleFeed`, because one parent’s posts can appear in more than one circle.

## 5. Files

| File | Change |
| --- | --- |
| `apps/mobile/src/constants/legal.ts` | `termsOfUse` URL |
| `apps/mobile/src/components/LegalFooter.tsx` | Terms sentence and link, above the auth buttons |
| `apps/mobile/app/(auth)/login.tsx` | Footer stays on the first screen |
| `apps/mobile/app/(auth)/register.tsx` | Same |
| `apps/mobile/src/lib/post-safety.ts` | New shared report + block sheet |
| `apps/mobile/app/circles/[circleId]/posts/[postId].tsx` | Use the shared sheet |
| `apps/mobile/app/circles/[circleId]/index.tsx` | ⋯ on other parents’ cards |
| `apps/mobile/src/lib/api.ts` | Optional `postId` / `circleId` on `blockUser` |
| `apps/mobile/src/lib/post-cache.ts` | `removeAuthorFromFeeds` |
| `apps/api/src/routes/me.ts` | Report row + safety email on a new block |
| `apps/api/src/lib/safety-alert.ts` | New email helper |
| `apps/api/src/services/feed.ts` | Block filter on circle feed and both home-feed SQL strings |
| `apps/api/src/services/feed-timeline.ts` | Same filter on timeline hydration |
| `apps/api/src/routes/circles.ts` | 404 the post thread when either parent has blocked the other |
| `.env.example` | `RESEND_API_KEY`, `SAFETY_ALERT_EMAIL`, `SAFETY_ALERT_FROM` |

No migration. `user_blocks` and `reports` already exist.

## Check before resubmitting

On a physical iPad or iPhone, in one recording:

1. Open the app logged out. The Terms of Use sentence is visible before tapping Apple, Google, or email.
2. Open a circle, tap ⋯ on someone else’s post, choose Report post, pick a reason, and see the reported confirmation.
3. Tap ⋯ again, choose Block parent, and confirm the card is gone from that circle list without pulling to refresh.

Then reply to the review message and put the same recording in App Review Information → Notes.
