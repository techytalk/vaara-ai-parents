# Post thread first paint — reuse, then refresh

Unblock opening, deleting, editing, and saving a post from extra network
round-trips. Do this in the mobile app only. Do not change the API or add
Redis post cache in this pass.

The Feed first-paint work already put posts, circles, and saved-post ids in
React Query. The thread and editor ignore that cache. They start from an empty
screen and refetch the same post.

This pass must treat a cached `CirclePost` as enough to paint the post body.
Replies, capabilities, and editor pickers can arrive after first paint.

### Final scheduling decision

“Show something” and “skip the network” are not the same. The thread still
needs `GET /v1/circles/:circleId/posts/:postId` for replies and
guest/member capabilities. The editor still needs a server `PATCH` to persist.

Use this order:

1. Look up a cached `CirclePost` locally (Home infinite pages, circle feed,
   or an already-fetched thread).
2. If one exists, render the post immediately. Do not show `ScreenLoader`.
3. Start `GET .../posts/:postId` immediately for replies and capabilities.
4. Read bookmark state from `["me","savedPostIds"]`. If that key is absent,
   start its shared fetch only after the authoritative thread response arrives;
   never put `getSaved` in the first-paint `Promise.all` with `getPost`.
5. Render comments when the thread request succeeds. A missing cache (push,
   notification, share link, Saved, Your posts) still waits on `getPost`.

Do not pass the full post through Expo Router params. Params are strings, the
payload includes media URLs, and a stale param would fight the cache. The
cache is the handoff.

Cold entry paths that usually have no `CirclePost` in cache:

- notification tap
- push response
- `/p/[shareId]` after `resolveShare`
- Saved list (`SavedPost` is a thin row, not a `CirclePost`)
- Your posts (`AuthoredPost` is a thin row, not a `CirclePost`)
- school profile links

Those paths keep the current spinner until `getPost` returns. That is
required, not a regression.

## Current code (what to replace)

### Open post — `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`

Local state starts empty. `loading` is `true`. The whole screen is
`ScreenLoader`.

`useFocusEffect` calls `load()` on every focus, including return from the
editor:

```ts
const [data, savedData] = await Promise.all([
  api.getPost(token, circleId, postId, shareId),
  api.getSaved(token).catch(() => ({ posts: [] })),
]);
setPost(data.post);
setComments(data.replies);
setSaved(savedData.posts.some((item) => item.id === postId));
```

`GET /v1/me/saved` downloads every saved post just to test one id. Home
already stores that as `["me","savedPostIds"]`.

Realtime `reply.new` calls the same `load()`, so a new comment also refetches
the saved list.

### Delete post — thread and circle feed

Thread delete:

```ts
await api.deletePost(token, circleId, postId);
queryClient.setQueryData(["circleFeed", circleId], /* filter posts */);
router.back();
```

Circle-feed delete does the same circle-feed patch and updates a **local**
`savedPostIds` `Set`. Neither path removes the post from `["homeFeed"]` or
`["me","savedPostIds"]`. Home can keep showing a deleted card until
pull-to-refresh or a realtime feed refresh.

### Edit post — `apps/mobile/app/circles/[circleId]/new-post.tsx`

`editReady` starts `false`, so the editor is `ScreenLoader`. Mount waits on
three APIs, **then** fetches the same post again:

```ts
const [circleList, mediaStatus, catalog] = await Promise.all([
  api.getCircles(token),
  api.getMediaStatus(token),
  api.getTopicsCatalog(token),
]);
const data = await api.getPost(token, circleId, postId);
```

Save waits again:

1. `GET /v1/circles` for a membership check
2. New media uploaded **one file after another**
3. `PATCH /v1/circles/:circleId/posts/:postId`
4. Invalidate `homeFeed`, `circleFeed`, `circles`, `topicFeed`
5. `router.back()`, which focus-reloads the thread (`getPost` + `getSaved`)

`updatePost` already returns a `CirclePost`. That response is thrown away.

## Query keys

Reuse the Feed keys. Add one thread key. Do not invent a second saved-id
store.

| Key | Fetcher | Cache value | Enabled | Retry |
|---|---|---|---|---|
| `["postThread", circleId, postId, shareId?]` | `api.getPost` | `{ post, replies, readOnly, capabilities, authoritative }` | immediately | `false` |
| `["me","savedPostIds"]` | `api.getSaved` → ids | `string[]` | cached immediately; otherwise after authoritative thread data | `false` |
| `["me","savedPosts"]` | `api.getSaved` | `SavedPost[]` | Saved screen mount | `false` |
| `["myPosts"]` | `api.getMyPosts` | `AuthoredPost[]` | Your posts screen mount | `false` |
| `["circles"]` | existing Feed query | `Circle[]` | existing Feed rule | `false` |
| `["homeFeed"]` | existing | infinite pages | existing | `false` |
| `["circleFeed", circleId]` | existing | `{ posts, memberCount }` | existing | `false` |
| `["topicsCatalog"]` | `api.getTopicsCatalog` | catalog JSON | editor mount | `false` |
| `["mediaStatus"]` | `api.getMediaStatus` | `{ configured }` | editor mount | `false` |

`["postThread", circleId, postId]` must include `circleId`. When `shareId` is
present, it **must** also be part of the key:
`["postThread", circleId, postId, shareId]`. A shared guest view can be
read-only and must not overwrite a member thread, or the reverse.

`retry: false` on these queries. `api.ts` already retries an idempotent GET
once.

Do not put a `Set` in the query cache. Keep saved ids as `string[]`.

## Shared helpers

Create `apps/mobile/src/lib/post-cache.ts` so Home, circle feed, thread, and
the editor do not each invent a cache shape.

`homeFeed` pages look like:

```ts
{
  pages: Array<{ posts: HomeFeedPost[]; nextCursor: string | null }>;
  pageParams: unknown[];
}
```

`circleFeed` looks like `{ posts: CirclePost[]; memberCount: number }`.

```ts
export function findCachedCirclePost(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId?: string
): CirclePost | undefined;

export function upsertPostInFeeds(
  queryClient: QueryClient,
  post: CirclePost,
  circleId: string
): void;

export function mergePostIntoMyPosts(
  queryClient: QueryClient,
  post: CirclePost,
  circleId: string
): void;

export function removePostFromFeeds(
  queryClient: QueryClient,
  postId: string,
  circleId: string
): void;

export function setSavedPostId(
  queryClient: QueryClient,
  postId: string,
  saved: boolean
): void;
```

`findCachedCirclePost` search order:

1. The exact thread key, including `shareId` when present
2. `["homeFeed"]` pages
3. `["circleFeed", circleId]`

Stop at the first full `CirclePost`. Do not treat `SavedPost` or
`AuthoredPost` as a seed.

`upsertPostInFeeds` maps the post in Home pages and in that circle’s feed.
It must **merge** into the existing cached item:

```ts
existing.id === post.id ? { ...existing, ...post } : existing
```

Do not replace a `HomeFeedPost` with the `CirclePost` returned by
`updatePost`: replacement would lose Home-only `circleId`, `circleName`, and
`discovery`. The helper does not invent a Home page if Home was never loaded.

`removePostFromFeeds` filters the post out of Home pages, that circle feed,
`["myPosts"]`, and `["me","savedPosts"]`; drops the id from
`["me","savedPostIds"]`; and removes every matching thread key with a query
predicate (base and share-id variants). When called by the mounted thread,
remove feed/list caches first, navigate back, then remove the active thread
query so deleting it cannot flash a loader before navigation finishes.

`setSavedPostId` writes a **new array** on `["me","savedPostIds"]`, same
pattern as Home. On unsave it also filters the item from
`["me","savedPosts"]`. On save it cannot safely synthesize a complete
`SavedPost`, so invalidate `["me","savedPosts"]` if that query exists.

401 / missing-token handling must use `isUnauthorized` and
`endAuthenticatedSession` from `apps/mobile/src/lib/authenticated-state.ts`.
Do not send anyone to onboarding from the thread or editor.

## File-by-file changes

### 1. `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`

This is the bulk of the open-post change.

#### 1a. Thread query — post may be seeded, replies come from the network

Delete local `load()`, `useState` for `post` / `comments` / `readOnly` /
`capabilities` / `saved` / `loading`. Keep local state for the comment
composer, `submitting`, `deleting`, and `error`.

```ts
const cachedPost = findCachedCirclePost(
  queryClient,
  circleId,
  postId,
  shareId
);

const threadQuery = useQuery({
  queryKey: shareId
    ? ["postThread", circleId, postId, shareId]
    : ["postThread", circleId, postId],
  queryFn: async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const data = await api.getPost(token, circleId, postId, shareId);
    return {
      post: data.post,
      replies: data.replies,
      readOnly: Boolean(data.readOnly ?? data.post.readOnly),
      capabilities: data.capabilities ?? null,
      authoritative: true,
    };
  },
  initialData: cachedPost
    ? {
        post: cachedPost,
        replies: [],
        // The feed does not carry authoritative thread permissions.
        readOnly: true,
        capabilities: null,
        authoritative: false,
      }
    : undefined,
  // Global staleTime is 30s. A feed-derived seed must still fetch now.
  initialDataUpdatedAt: cachedPost ? 0 : undefined,
  retry: false,
});
```

`initialData` from a feed card will not include replies. That is intended.
`initialDataUpdatedAt: 0` is required: without it, the global 30-second
`staleTime` can treat the seed as fresh and skip the request that supplies
replies and capabilities.

Use the explicit `authoritative` flag rather than `isSuccess`: React Query
reports success for `initialData`. Show the post and a small comments-loading
row until `authoritative === true`.

Distinguish seed vs server data:

- `hasPost` = `threadQuery.data?.post != null`
- Full-screen `ScreenLoader` only when there is **no** post to show
- Comments: if `!threadQuery.data?.authoritative`, show
  “Loading comments”. Do not claim “No comments yet” until the network
  result arrives
- After the network result, empty replies are a real empty state

Seeded content is display-only. Until `authoritative === true`, hide or
disable every action whose availability comes from thread access:

- edit and delete
- save
- reply
- poll vote and helpful
- message-author
- any action currently using `capabilities?.x ?? !readOnly`

Do not use `readOnly: false` as a seed fallback. A shared-link entry can be
read-only, and briefly enabling actions before the server responds is an
authorization/UI bug. Generic back and share controls may remain available.

If `getPost` fails and a seed is on screen, keep the seed and show an inline
retry for comments. If `getPost` fails with no seed, show the existing
not-found / error copy plus Retry (`threadQuery.refetch()`).

401 / `"Not signed in"` → `endAuthenticatedSession()` then login. Guard with
`authExitStartedRef`, same as Feed.

#### 1b. Saved bookmark — shared cache only

```ts
const savedQuery = useQuery({
  queryKey: ["me", "savedPostIds"],
  queryFn: async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const result = await api.getSaved(token);
    return result.posts.map((post) => post.id);
  },
  // Cached ids are usable immediately. A cache miss must not compete with
  // the post/replies request.
  enabled:
    queryClient.getQueryData<string[]>(["me", "savedPostIds"]) !== undefined ||
    threadQuery.data?.authoritative === true,
  retry: false,
});
const saved = (savedQuery.data ?? []).includes(postId);
```

If Home already fetched the key, React Query reuses/deduplicates it. On a
cold thread entry, `getSaved` starts only after `getPost` succeeds. It is not
a first-paint dependency and its error must not replace the post error UI.

Until `savedQuery.isSuccess`, hide or disable the bookmark control
(`onToggleSave` / header bookmark). After success, keep today’s pessimistic
save: wait for `saveItem` / `unsaveItem`, then `setSavedPostId`. On failure,
leave the cache unchanged.

`capabilities?.canSave === false` still hides the control.

#### 1c. Replace local post/comment mutations with query-cache writes

Deleting local `post` and `comments` state means all existing mutation
handlers must write the thread query:

- add reply: append the returned comment to `replies`, increment
  `post.replyCount`, and merge that count into Home/circle-feed caches;
- helpful toggle: merge `myHelpful` and `helpfulCount` into the thread and
  feed caches;
- poll vote: merge the returned `poll` into the thread and feed caches;
- edit result: replace/merge `post` while preserving `replies`, `readOnly`,
  `capabilities`, and `authoritative`.

Use functional `setQueryData` updates so concurrent realtime replies are not
overwritten. Do not retain shadow local copies of the same post or replies.

#### 1d. Remove focus refetch

Delete the `useFocusEffect` that calls `load()`. Returning from the editor
must not refetch. The editor writes `["postThread", ...]` before
`router.back()` (section 3).

Realtime stays:

- `reply.new` for this `postId` → `queryClient.invalidateQueries` on the
  thread key only. Do not refetch saved ids
- keep the existing 60s poll fallback on `useRealtimeChannel`, pointed at
  the thread query, not a full `getSaved`

#### 1e. Delete

After `DELETE` succeeds:

```ts
removePostFromFeeds(queryClient, postId, circleId);
router.back();
```

Do not wait to refetch Home. The deleted card must be gone from Feed and
the circle list when the user lands there.

Keep the confirm alert and the header-icon `deleting` disable. Do not put a
full-screen loader on delete.

`removePostFromFeeds` also removes the row from `["myPosts"]` and
`["me","savedPosts"]`; invalidating a key that no component reads is not
enough.

### 2. Circle-feed delete and save — same cache writes

`apps/mobile/app/circles/[circleId]/index.tsx` already deletes from
`["circleFeed", circleId]`. Change it to call `removePostFromFeeds` so Home
and saved ids stay aligned.

Circle-feed `toggleSave` still uses a local `Set`. In this pass, after API
success, also call `setSavedPostId`. Do **not** expand this file into a
circle-feed first-paint refactor (it still fans out feed + members + saved +
mutes). That is a later pass.

### 3. Saved and Your Posts — make invalidation real

`apps/mobile/app/(app)/saved.tsx` and
`apps/mobile/app/(app)/your-posts.tsx` currently keep API results only in
local state. Updating or invalidating React Query keys would not change an
already-mounted screen underneath the thread route.

Convert their existing loaders to `useQuery`:

```ts
const savedPostsQuery = useQuery({
  queryKey: ["me", "savedPosts"],
  queryFn: () => authed((token) => api.getSaved(token).then((r) => r.posts)),
  retry: false,
});

const myPostsQuery = useQuery({
  queryKey: ["myPosts"],
  queryFn: () => authed((token) => api.getMyPosts(token).then((r) => r.posts)),
  retry: false,
});
```

Keep their pull-to-refresh controls, pointed at `refetch()`. Use the shared
401 cleanup. Their screen UI otherwise stays unchanged.

Cache synchronization rules:

- delete filters the post from both keys immediately;
- edit merges updated fields into `["myPosts"]` while preserving thin-row
  fields such as `circleId`, `circleName`, `targets`, and access state;
- unsave filters `["me","savedPosts"]`;
- save invalidates `["me","savedPosts"]` because a complete `SavedPost`
  cannot be constructed from an id alone.

This is the minimum required to prevent stale rows when returning with
`router.back()`. It is not a broader redesign of either screen.

### 4. `apps/mobile/app/circles/[circleId]/new-post.tsx`

#### 4a. Edit first paint — seed the form, then refresh pickers

When `isEditing`:

1. Read `["postThread", circleId, postId]` or `findCachedCirclePost`.
2. If a `CirclePost` exists, populate body / tag / media / documents / poll /
   topics through lazy `useState` initialization and set `editReady` true
   immediately.
3. Only if there is no seed, call `api.getPost` and keep `ScreenLoader`.
4. Authorship check uses `["sessionUser"]` or `getStoredUser()`. If the
   author is not the current user, keep the existing “Can’t edit” alert.

Do not block the form on circles, media status, or topics.

Extract one pure `editorStateFromPost(post)` mapper and use it for both the
lazy cached initialization and the cold `getPost` result. Do not call state
setters during render and do not maintain two different mapping paths.

When a cold editor calls `getPost`, also seed the exact thread query with
`authoritative: true`, including replies and capabilities from that response.
Then save can update that query and `router.back()` without another GET.

#### 4b. Picker queries — parallel, not gating

```ts
const circlesQuery = useQuery({
  queryKey: ["circles"],
  queryFn: () => /* authed getCircles */,
  retry: false,
});
const topicsQuery = useQuery({
  queryKey: ["topicsCatalog"],
  queryFn: () => /* authed getTopicsCatalog */,
  retry: false,
});
const mediaStatusQuery = useQuery({
  queryKey: ["mediaStatus"],
  queryFn: () => /* authed getMediaStatus */,
  retry: false,
});
```

New-post (not edit) can also use `["circles"]` as `initialData` so the
audience label does not wait on a duplicate `getCircles` when Feed already
loaded circles.

UI rules while pickers are pending:

- topic chip / sheet: disabled until `topicsQuery.isSuccess`
- photo / video pickers: disabled until `mediaStatusQuery.data?.configured`
  is known; if `configured === false`, keep today’s hidden/disabled behavior
- audience sheet: disabled until `circlesQuery.isSuccess`
- if `circlesQuery.isError` on edit, still allow save to the current
  `circleId` (the user already opened this circle). On new-post, keep a
  membership error if there is no circle to post to

Do not catch these queries and return empty objects. Empty catalog / circles
must remain an error, not a cached success.

401 / missing-token from the post query, picker queries, membership fallback,
uploads, or `updatePost` must use the shared guarded authenticated-session
cleanup. Other picker errors stay local and must not blank an already-seeded
edit form.

#### 4c. Save — no extra circles GET, bounded uploads, write caches

Remove the submit-time `api.getCircles` membership refetch when
`circlesQuery.data` already contains `circleId`. If circles are missing
(query error / never loaded), then fetch once.

Upload **new** media with bounded concurrency of **2**, not an unrestricted
`Promise.all` and not a serial `for` loop. Large image/video bodies are held
in memory; launching every upload together can exhaust memory on older
phones. Preserve input order in the returned payload. Existing media
(`item.id`) stays as `{ id }` and is not re-uploaded.

Use one shared helper for create and edit, for example:

```ts
uploadMediaWithConcurrency(items, 2, uploadOne)
```

Keep a single progress string such as `Uploading 2 of 4…`, updated after each
completed item. Documents that are already `clean` stay as they are; do not
change document scan order in this pass.

`updatePost` returns `CirclePost`. Use it:

```ts
const updated = await api.updatePost(...);
queryClient.setQueryData(
  ["postThread", circleId, postId],
  (current) =>
    current
      ? { ...current, post: updated }
      : current
);
upsertPostInFeeds(queryClient, updated, circleId);
mergePostIntoMyPosts(queryClient, updated, circleId);
queryClient.invalidateQueries({ queryKey: ["topicFeed"] });
router.back();
```

The normal edit path must already have an authoritative thread cache from
the thread screen or the editor’s cold `getPost`, so `current` should exist.
Do not create a fake cache entry with `readOnly: false` and unknown
capabilities. If it is unexpectedly absent, invalidate the exact thread key
after navigation so the next open fetches authoritative data.

Do **not** invalidate `["homeFeed"]` or `["circleFeed"]` after a successful
patch if `upsertPostInFeeds` ran. Invalidation would refetch the list the
user is about to see and undo the first-paint win.

Do **not** invalidate `["circles"]` on edit save. Circle membership did not
change. Keep the existing invalidations on **create** (`createCrossPosts`),
including `["homeFeed"]`, `["circleFeed"]`, `["circles"]`, and `["myPosts"]`.

Create-path `uploadMedia` should use the same bounded-concurrency helper as
edit. One helper, both paths.

### 5. Home feed — no navigation-param changes

`apps/mobile/app/(app)/index.tsx` already navigates with `circleId`,
`postId`, and `title`. Leave that. Seeding is cache lookup, not new params.

Home `toggleSave` already writes `["me","savedPostIds"]`. No change required
there.

Home does not delete posts today. Thread and circle feed own delete.

### 6. No API / Redis / layout changes

Do not edit:

- `apps/api` post or feed routes
- `packages/redis`
- `apps/mobile/app/(app)/_layout.tsx`
- `apps/mobile/app/p/[shareId].tsx` beyond leaving it as a cache-less entry

`GET /v1/me/saved` stays as the source for the saved-ids query. Do not add
a per-post saved endpoint in this pass.

## Behavior after the change

| Moment | Network | UI |
|---|---|---|
| Tap a Home / circle-feed card | `getPost` for replies; cached saved ids reused | Post body visible immediately; permission actions wait; comments fill in |
| Tap a notification / share / Saved / Your posts row | `getPost` (no seed) | Spinner until that JSON, same as today |
| New reply via realtime | thread query refetch | Comment list updates; post body stays |
| Return from editor | none | Thread shows the patched post |
| Delete | `DELETE` only | Card gone from thread, circle feed, and Home |
| Open editor from thread | picker queries if stale; no `getPost` if seeded | Form visible immediately |
| Save edit | `PATCH` + up to 2 concurrent new uploads | Back to thread with updated post; lists patched |
| Bookmark on thread | `saveItem` / `unsaveItem` | Icon after API success; Home bookmark matches |
| Return to Saved / Your posts | no stale local row | Deleted/unsaved/edited row already reconciled |
| 401 on thread | session cleared | Login, no leftover thread |

## What not to change in this pass

- Home-feed Redis / discovery SQL / image CDN
- Circle-feed first-paint (still one queryFn for feed + members + saved + mutes)
- Passing `childrenQuery` or session user into the thread
- Optimistic delete or optimistic bookmark
- Changing document upload / virus-scan order
- Rewriting compose for new posts beyond sharing `["circles"]` and bounded
  uploads
- Adding a `GET /saved/:postId` API

## Test plan

1. From Home, tap a post that is already on screen: no full-screen loader.
   Body, media, and author appear immediately. Comments can appear a beat
   later. Edit/delete/reply/vote/helpful/message/save controls do not appear
   enabled before authoritative capabilities arrive.
2. Charles / Proxyman on that tap: `GET .../posts/:id` starts immediately
   despite the 30-second global stale time. If saved ids are already fresh,
   no saved request starts. On a cold cache, `getSaved` starts only after
   `getPost` succeeds and never blocks the post.
3. From a circle feed card: same instant body; delete from the circle list
   also removes the card from Home without pull-to-refresh.
4. Notification / push / share link / Saved / Your posts: spinner until
   `getPost` (no false empty post).
5. Shared `shareId` uses a distinct query key and stays read-only. A cached
   member post may paint content but cannot enable member actions before or
   after the shared response.
6. Empty comments after the network result: “No comments yet”. While the
   seeded post is waiting on `getPost`, do not show that empty copy.
7. Post a comment: the thread query appends it, reply count updates in thread
   and feeds, and no full reload occurs.
8. Realtime reply from someone else: comments refresh; bookmark state does
   not flicker.
9. Delete from the thread: confirm, `DELETE`, back. Home and circle feed no
   longer show the post. Bookmark cache no longer contains its id.
10. Open edit from the thread: no full-screen loader when the thread already
    had the post. Body / poll / existing photos are filled in.
11. Topic and photo controls stay inert until their picker queries succeed;
    save still works without them if the user only edits text.
12. Save a text-only edit: one `PATCH`, no `GET /v1/circles` if circles are
    cached, no Home refetch. Thread and Home show the new text immediately.
13. Save an edit that adds four photos: no more than two uploads overlap,
    payload order is stable, then one `PATCH`. Thread shows the new media
    after back.
14. Failed `PATCH`: stay on the editor with the existing error alert; thread
    cache unchanged.
15. Bookmark on the thread, back to Home: icon matches without pull-to-refresh.
16. Bookmark on Home, open the thread: icon is already filled (shared cache).
17. Delete from a thread opened over Your Posts, or unsave from a thread
    opened over Saved: `router.back()` does not reveal a stale row. Edited
    text also updates an already-mounted Your Posts list.
18. 401 on `getPost`, a picker query, membership fallback, or save: session
    and query cache cleared, login opens.
19. `getPost` fails with a seeded post: post stays, comments area offers
    Retry. `getPost` fails with no seed: error / not-found plus Retry, not an
    infinite spinner.
20. Switch away from the thread and back (no editor): no automatic
    `getPost` / `getSaved` within 30s.
21. Create a new post (not edit): still invalidates Home and opens the
    thread. Bounded-concurrency uploads apply. Audience can use cached circles.
22. Simulate repeated 10-second timeouts: thread / circles / topics /
    media-status / saved-ids queries get only the API wrapper’s two attempts,
    not a second React Query retry cycle.
23. Provider accounts and onboarding routing stay unchanged. This pass does
    not add onboarding redirects on the thread.
