# Home feed first paint — lazy meta

Unblock `GET /v1/me/feed` from five header APIs. Do this in the mobile app
only. Do not change the API or add Redis home-feed cache in this pass.

Reaching the Feed tab usually means onboarding is done:
`apps/mobile/app/index.tsx` calls `GET /v1/me` and only redirects to `/(app)`
when `user.onboardingComplete` is true.

Exception: several warm paths navigate directly to `/(app)` and skip
`app/index.tsx`: onboarding ready, children screens, prompt-driven child
changes, tour completion, and error recovery. Home must therefore remain safe
when entered without the cold-start gate. It must never redirect a transient
circles error to onboarding.

Home today seeds user/circles/children from the synchronous in-memory
onboarding draft and then clears it. Preserve that optimization for **every**
entry path by snapshotting the draft once when Home mounts, using the snapshot
as React Query `initialData`, and clearing the draft after the snapshot is
captured. Do not make `ready.tsx` the only path capable of seeding the cache.

### Final scheduling decision

“Non-blocking” and “lazy” are not the same. Mounting six `useQuery` hooks with
no `enabled` condition would still start six requests together and let meta
traffic compete with the feed.

Use this order:

1. Read the token and any already-cached/drafted user data locally.
2. Start `GET /v1/me/feed` immediately.
3. Only after `feedQuery.isSuccess`, enable user refresh, circles,
   notifications, saved-post ids, and children queries.
4. Render posts without waiting for any query from step 3.

If circles/user/children were seeded from the onboarding draft, their queries
already have useful data while disabled; after the feed succeeds, normal
30-second freshness rules decide whether a network refresh is necessary.

## Current code (what to replace)

All of this lives in `apps/mobile/app/(app)/index.tsx`.

`loadMeta()` fans out five GETs, then redirects if onboarding is incomplete:

```ts
const [me, circleList, kids, notifications, saved] = await Promise.all([
  seededUser ?? api.me(token),
  seededCircles ?? api.getCircles(token),
  seededChildren ?? api.getChildren(token).catch(() => [] as Child[]),
  api.getNotifications(token).catch(() => []),
  api.getSaved(token).catch(() => ({ posts: [] })),
]);

if (!me.onboardingComplete) {
  router.replace(await resolveParentOnboardingHref(token));
}
```

The feed query waits for that before requesting posts (first page only):

```ts
queryFn: async ({ pageParam }) => {
  const token = await getToken();
  if (!pageParam) await loadMeta();
  return api.getHomeFeed(token, { cursor: pageParam, limit: 20 });
}
```

Every time the tab is focused, both run again:

```ts
useFocusEffect(() => {
  loadMeta();
  refreshFeed(); // invalidateQueries(["homeFeed"])
});
```

That focus refetch is also how the bell badge catches up after the
notifications screen marks items read. Removing it without updating the
notifications cache is a regression — see 1e and section 4.

Pull-to-refresh also awaits `loadMeta()` then `feedQuery.refetch()`.

Local state that `loadMeta` fills today:

| State | Source | UI |
|---|---|---|
| `user` | `GET /v1/me` or onboarding draft | Greeting, avatars, report visibility, tour gate |
| `circles` | `GET /v1/circles` or draft | Composer / FAB, empty copy, realtime, tour |
| `unreadAlerts` | `GET /v1/me/notifications` | Bell badge |
| `savedPostIds` | `GET /v1/me/saved` | Bookmark fill |
| `activePrompt` | children + circles | `CompletionPrompt` |

`loading` is `feedQuery.isLoading && posts.length === 0`. After this change
that spinner must depend only on the feed query, never on meta. Feed has
no error UI today; after retries, a failed `getHomeFeed` is incorrectly shown
as a successful “No posts yet” state. This pass must add 401 → login and other
errors → retry empty state (see 1a).

## Query keys

Use these exact keys so pull-to-refresh, realtime, sign-out, and the
notifications screen can target them.

| Key | Fetcher | Cache value | Enabled | Retry |
|---|---|---|---|---|
| `["homeFeed"]` | `api.getHomeFeed` | infinite-query pages | immediately | `false` |
| `["sessionUser"]` | `api.me`; cache is seeded on auth/draft entry | `AuthUser` | after feed succeeds | `false` |
| `["circles"]` | `api.getCircles` | `Circle[]` | after feed succeeds | `false` |
| `["me","children"]` | `api.getChildren` | `Child[]` | after feed succeeds | `false` |
| `["me","notifications"]` | `api.getNotifications` | `AppNotification[]` | after feed succeeds | `false` |
| `["me","savedPostIds"]` | `api.getSaved` → post ids | `string[]` (not a `Set`) | after feed succeeds | `false` |

`["circles"]` is already passed to `invalidateQueries` from
`new-post.tsx` and the circle screen. Nothing *reads* it yet. Feed will
be the first reader. The Circles tab still calls `api.getCircles` on its
own; do not assume one fetch serves both tabs in this pass.

All use the existing 30-second stale time. Override `retry: false` on these
queries because `apps/mobile/src/lib/api.ts` already retries an idempotent GET
once. Leaving the global React Query retry enabled would retry that two-attempt
operation again and can turn two 10-second timeouts into roughly 40 seconds.

Do not put a `Set` in the query cache. React Query structural sharing
does not treat `Set` well. Store `string[]` and derive a `Set` in
`useMemo` on the Feed screen if needed.

Tab switch must not refetch. This project does not configure React Query’s
React Native `focusManager` / `onlineManager`, so do not assume app foreground
or reconnection automatically refetches stale queries. In this pass:

- notification foreground freshness is handled explicitly in section 5;
- feed freshness comes from realtime events and pull-to-refresh;
- adding a global AppState/online integration is a separate decision.

## File-by-file changes

### 1. `apps/mobile/app/(app)/index.tsx`

This is the bulk of the change. Delete `loadMeta`. Do not add a replacement
bundle function.

#### 1a. Feed query — posts only

Remove `if (!pageParam) await loadMeta()`.

```ts
const feedQuery = useInfiniteQuery({
  queryKey: ["homeFeed"],
  initialPageParam: undefined as string | undefined,
  queryFn: async ({ pageParam }) => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    return api.getHomeFeed(token, {
      cursor: pageParam,
      limit: 20,
    });
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  retry: false, // api.ts already retries an idempotent GET once
});
```

Keep `loading = feedQuery.isLoading && posts.length === 0` for the first
successful path.

Auth and errors (this pass, Feed owns this):

- No token (the locally-thrown `"Not signed in"` error), or feed error with
  `status === 401` → call the shared authenticated-state cleanup from section
  3, then `router.replace("/(auth)/login")`. Do this in a `useEffect` watching
  `feedQuery.error`, not inside `queryFn`.
- Any other feed error → do not keep `ScreenLoader`. Show the existing
  `EmptyState` (or equivalent) with a retry that calls `feedQuery.refetch()`.
- Do not send anyone to onboarding from this screen.

After retries are exhausted, the current code does not literally spin forever:
`isLoading` becomes false and it renders the misleading “No posts yet” state.
The required fix is to distinguish `feedQuery.isError` from a successful empty
feed and provide Retry.

Use one guarded auth-exit effect for feed and meta errors. Add an
`isUnauthorized(error)` helper (`status === 401`, plus the local
`"Not signed in"` case), and protect cleanup with
`authExitStartedRef.current` so simultaneous failures do not trigger multiple
SecureStore clears and redirects:

```ts
useEffect(() => {
  const unauthorized = [
    feedQuery.error,
    userQuery.error,
    circlesQuery.error,
    notificationsQuery.error,
    savedQuery.error,
    childrenQuery.error,
  ].some(isUnauthorized);
  if (!unauthorized || authExitStartedRef.current) return;

  authExitStartedRef.current = true;
  void endAuthenticatedSession().finally(() => {
    router.replace("/(auth)/login");
  });
}, [
  feedQuery.error,
  userQuery.error,
  circlesQuery.error,
  notificationsQuery.error,
  savedQuery.error,
  childrenQuery.error,
  router,
]);
```

Realtime `refreshFeed()` stays as `invalidateQueries({ queryKey: ["homeFeed"] })`.
That refetches every loaded page if the user has scrolled. Pre-existing;
leave it.

#### 1b. Token helper for meta queries

Meta `useQuery` hooks need a token without blocking the feed:

```ts
async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}
```

Do **not** catch query failures and return empty arrays. Independent React Query
errors do not break the Feed screen; the UI can derive a temporary empty value
from `data ?? []`. Returning `[]` marks a failed request as successful and
caches false data for 30 seconds. For children that can create an incorrect
completion prompt.

Keep errors as errors for all five meta queries:

- notifications/saved: derive badge/bookmark defaults from `data ?? []`;
- children: evaluate prompts only when `childrenQuery.isSuccess`;
- circles: distinguish `isError` from a successful empty list;
- any meta 401: the feed request will normally detect the same expired token,
  but all auth-failure handling must call the same cleanup helper.

Set `retry: false`; the API wrapper already performs one GET retry.

#### 1c. Session user — no onboarding redirect on Feed

Delete:

- `api.me` as a Feed blocker
- `if (!me.onboardingComplete) { resolveParentOnboardingHref; router.replace }`

Do **not** send the user back to onboarding from this screen. If
`onboardingComplete` is somehow false, `app/index.tsx` still owns that on
the next cold start. `ready.tsx` already finished onboarding.

Use cached/drafted session data immediately, then allow `api.me` to refresh it
after the feed succeeds. Do not set `staleTime: Infinity`.

`getStoredUser()` is asynchronous, so it cannot be supplied directly as React
Query `initialData` or `placeholderData`. Do not leave this as an
implementation choice:

1. Every successful auth entry (`login`, `register`, and social-auth callbacks)
   must use the shared `beginAuthenticatedSession()` helper in section 3. It
   saves the session and seeds `["sessionUser"]`.
2. `apps/mobile/app/index.tsx`, which already calls `api.me`, must seed
   `["sessionUser"]` immediately after `saveSession`.
3. Home snapshots `getOnboardingUser()` synchronously with the other draft
   values and may use it as `initialData`.
4. The `sessionUser` query is enabled only after `feedQuery.isSuccess`; its
   query function calls `api.me`, calls `saveSession`, and returns `me`.

```ts
const userQuery = useQuery({
  queryKey: ["sessionUser"],
  queryFn: async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const me = await api.me(token);
    await saveSession(token, me);
    return me;
  },
  initialData: draftSnapshot.user ?? undefined,
  enabled: feedQuery.isSuccess,
  retry: false,
});
const user = userQuery.data ?? null;
```

Greeting already falls back to `"Parent"` if no seed is available.

Imports to add: `saveSession` plus the onboarding draft getters needed by the
snapshot. Remove `resolveParentOnboardingHref`; Feed no longer owns onboarding
routing.

#### 1d. Circles — parallel, not blocking

```ts
const circlesQuery = useQuery({
  queryKey: ["circles"],
  queryFn: () => authed((token) => api.getCircles(token)),
  initialData: draftSnapshot.circles ?? undefined,
  enabled: feedQuery.isSuccess,
  retry: false,
});
const circles = circlesQuery.data ?? [];
```

If the onboarding draft supplied circles, this is useful data before the
network query is enabled and remains fresh for 30 seconds.

Keep `pickPrimaryCircle(circles)` as today.

`openNewPost()` today sends the user to `/onboarding/children` when there
is no primary circle. After this change that can fire while circles are
still loading or after a failed fetch. Change it to:

- if `circlesQuery.isPending` → no-op (buttons disabled)
- if `circlesQuery.isError` → no-op (do **not** open onboarding)
- if success and empty → keep `router.push("/onboarding/children")`
- if success and has a circle → existing composer route

Disable the compose row, action chips, empty-state “Create post”, and FAB
while `circlesQuery.isPending` or `circlesQuery.isError`. FAB already
hides when `!primaryCircle`; keep that for pending. On error, do not use
the empty-state CTA “Complete profile”.

Empty-state copy that uses `circles.length === 0` must not say “Complete
your profile” while pending or error. Treat pending/error as
“circles unknown”, not “no circles”.

Realtime stays as today: `useRealtimeChannels` with
`enabled: circleChannels.length > 0`. Channels start when circles arrive.

`HomeTourOverlay` already takes `circles`. Tour starts when
`!loading && Boolean(user)`. After this change, `loading` is feed-only, so
the tour can start before circles load. Tighten the tour gate to
`!feedQuery.isLoading && Boolean(user) && circlesQuery.isSuccess`.

The overlay still calls `api.getChildren` when it opens. Leave that in
this pass (extra request, not a first-paint block). Optionally pass
`childrenQuery.data` later.

#### 1e. Notifications — bell only

```ts
const notificationsQuery = useQuery({
  queryKey: ["me", "notifications"],
  queryFn: () => authed((token) => api.getNotifications(token)),
  enabled: feedQuery.isSuccess,
  retry: false,
});
const unreadAlerts =
  notificationsQuery.data?.filter((item) => !item.readAt).length ?? 0;
```

Bell stays tappable with no badge until this resolves.

Because Feed no longer refetches on tab focus, the notifications screen
must write this cache when the user marks items read (section 4).
Otherwise the badge stays wrong for 30s.

#### 1f. Saved posts — bookmark fill only

```ts
const savedQuery = useQuery({
  queryKey: ["me", "savedPostIds"],
  queryFn: async () => {
    const result = await authed((token) => api.getSaved(token));
    return result.posts.map((post) => post.id);
  },
  enabled: feedQuery.isSuccess,
  retry: false,
});
const savedPostIds = useMemo(
  () => new Set(savedQuery.data ?? []),
  [savedQuery.data]
);
```

The current implementation is **pessimistic**: it updates UI after the API
succeeds. Do not describe it as an existing optimistic update.

For this pass, preserve that reliable behavior and eliminate the pending-query
race:

- Pass `onToggleSave={undefined}` until `savedQuery.isSuccess`, so the user
  cannot mutate while the initial saved-id response is still in flight.
- After `saveItem` / `unsaveItem` succeeds, update the query cache with a
  **new array**:

```ts
queryClient.setQueryData(
  ["me", "savedPostIds"],
  (current: string[] | undefined) => {
    const next = new Set(current ?? []);
    if (isSaved) next.delete(postId);
    else next.add(postId);
    return [...next];
  }
);
```

If the mutation fails, leave the cache unchanged. A future PR may implement a
true optimistic mutation with `cancelQueries`, snapshot, rollback, and
invalidation; it is unnecessary for first-paint performance.

`FeedPostCard` `saved={savedPostIds.has(item.id)}` stays. Bookmarks start
outlined, then fill.

Saving from a post thread / circle feed is **not** wired to this cache in
this pass. Those screens can stay as they are; Feed may be up to 30s
stale if the user saved elsewhere. Call that out in the PR, do not expand
scope.

#### 1g. Children + completion prompt — after paint

```ts
const childrenQuery = useQuery({
  queryKey: ["me", "children"],
  queryFn: () => authed((token) => api.getChildren(token)),
  initialData: draftSnapshot.children ?? undefined,
  enabled: feedQuery.isSuccess,
  retry: false,
});
```

Derive the prompt with `useEffect` once both `childrenQuery.data` and
`circlesQuery.data` exist and **both queries are successful**:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (
      !feedQuery.isSuccess ||
      !circlesQuery.isSuccess ||
      !childrenQuery.isSuccess
    ) {
      setActivePrompt(null);
      return;
    }
    if (!(await hasCompletedAppTour())) {
      if (!cancelled) setActivePrompt(null);
      return;
    }
    const gaps = evaluateCompletionGaps({
      children: childrenQuery.data,
      circles: circlesQuery.data,
    });
    const prompt = await pickActiveCompletionPrompt(gaps);
    if (!cancelled) setActivePrompt(prompt);
  })();
  return () => {
    cancelled = true;
  };
}, [
  feedQuery.isSuccess,
  childrenQuery.data,
  childrenQuery.isSuccess,
  circlesQuery.data,
  circlesQuery.isSuccess,
]);
```

Prompt appears after feed cards. That is intended.

#### 1h. Remove `useFocusEffect` refetch

Delete the entire `useFocusEffect` block that calls `loadMeta` +
`refreshFeed`.

Do not refetch feed, circles, notifications, or saved on tab focus.
Default `staleTime` (30s) is enough. Switching to Messages and back must
keep the list on screen.

Realtime still calls `refreshFeed()` on `post.new` / `reply.new`. Keep
that. Keep the 60s poll fallback on `useRealtimeChannels`.

#### 1i. Pull-to-refresh — explicit full refresh

```ts
onRefresh={async () => {
  await Promise.all([
    feedQuery.refetch(),
    userQuery.refetch(),
    circlesQuery.refetch(),
    notificationsQuery.refetch(),
    savedQuery.refetch(),
    childrenQuery.refetch(),
  ]);
}}
```

`refreshing` stays
`feedQuery.isRefetching && !feedQuery.isFetchingNextPage` so the spinner
tracks the list, not the bell.

#### 1j. Delete leftover state

Remove `useState` for `user`, `circles`, `unreadAlerts`, `savedPostIds`.
Keep `activePrompt` (derived, still local). Remove `useCallback` for
`loadMeta`. Remove unused imports (`useFocusEffect` if unused,
`resolveParentOnboardingHref`). Keep the onboarding-draft getters and
`clearOnboardingDraft` for the one-time snapshot in section 2.

`refreshFeed` stays for realtime.

### 2. Preserve onboarding data across every Feed entry path

Do not solve draft handoff only in `onboarding/ready.tsx`. Children screens,
prompt-driven edits, tour completion, and error recovery can also navigate
directly to `/(app)`.

In Home, capture draft values exactly once:

```ts
const [draftSnapshot] = useState(() => ({
  user: getOnboardingUser(),
  circles: getOnboardingCircles(),
  children: getOnboardingChildren(),
}));

useEffect(() => {
  clearOnboardingDraft();
}, []);
```

Use `draftSnapshot.user`, `.circles`, and `.children` as `initialData` for the
corresponding queries. Because the snapshot is component state, clearing the
global draft does not remove data the queries still need.

`onboarding/ready.tsx` may additionally write its already-loaded `circles` and
merged user into the same query keys before navigation, but correctness must
not depend on that one route.

Mutation routes that return to an already-mounted Feed must invalidate or
update their affected keys after success:

- child add/edit/delete: `["me","children"]`, `["circles"]`,
  `["sessionUser"]` when the response includes the updated user;
- location/community/school changes: `["circles"]`, and
  `["me","children"]` when child data changed;
- new post: existing `["homeFeed"]` and `["circles"]` invalidations remain.

This prevents a completion prompt from using pre-mutation children/circles for
up to 30 seconds.

### 3. Central authenticated-session and cache lifecycle

`QueryClient` is a process singleton. Clearing only SecureStore is unsafe:
another account can briefly see the previous account’s feed, user, circles,
and bookmark data.

Create one shared helper module (for example
`apps/mobile/src/lib/authenticated-state.ts`) that imports `clearSession`,
`saveSession`, and the exported `queryClient`:

```ts
export async function beginAuthenticatedSession(
  token: string,
  user: AuthUser
) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await saveSession(token, user);
  queryClient.setQueryData(["sessionUser"], user);
}

export async function endAuthenticatedSession() {
  await queryClient.cancelQueries();
  await clearSession();
  queryClient.clear();
}
```

Use `beginAuthenticatedSession` only for a new authentication boundary:

- password login and registration;
- Google and Apple completion callbacks (they already flow through the auth
  screens’ `completeAuth`);
- any future account-switch action.

Do **not** use it for `saveSession` calls that merely update the current
account during onboarding; those must not wipe the new feed cache.

Use `endAuthenticatedSession` for:

- `SignOutButton`;
- account deletion after the API confirms deletion;
- the provider profile’s independent sign-out implementation;
- Feed missing-token / 401 handling;
- any other forced re-auth path.

On cold start, `apps/mobile/app/index.tsx` already fetches `api.me` and calls
`saveSession`. It must also call
`queryClient.setQueryData(["sessionUser"], user)` before navigating. This is a
required part of the pass, not optional.

### 4. `apps/mobile/app/(app)/notifications/index.tsx`

When marking one or all as read, update `["me","notifications"]` so the
Feed bell badge matches without a tab-focus refetch.

After a successful `markNotificationRead`, update one item:

```ts
queryClient.setQueryData(
  ["me", "notifications"],
  (current: AppNotification[] | undefined) => {
    if (!current) return current;
    const now = new Date().toISOString();
    return current.map((n) =>
      n.id === item.id ? { ...n, readAt: n.readAt ?? now } : n
    );
  }
);
```

After a successful `markAllNotificationsRead`, update all items:

```ts
queryClient.setQueryData(
  ["me", "notifications"],
  (current: AppNotification[] | undefined) => {
    if (!current) return current;
    const now = new Date().toISOString();
    return current.map((n) => ({ ...n, readAt: n.readAt ?? now }));
  }
);
```

Keep the screen’s local `setItems` as well, or switch that screen to the
same query later. Cache writes happen only after the API succeeds.

### 5. New-notification badge updates

Removing tab-focus refetch also removes the old fallback that discovered new
notifications. In `apps/mobile/src/lib/push.ts`:

- add a foreground notification-received listener that invalidates
  `["me","notifications"]`;
- when `AppState` becomes active, invalidate that key as a fallback;
- remove the listener during `setupPushNotifications()` cleanup.

This is an invalidation, not direct badge arithmetic: the server remains the
source of truth. An invalidated disabled query waits until it is enabled after
the feed succeeds.

### 6. No API / Redis / app-layout changes

Do not edit:

- `apps/api/src/routes/me.ts` (`GET /feed`)
- `apps/api/src/services/feed.ts`
- `packages/redis/src/cache.ts`
- `apps/mobile/app/(app)/_layout.tsx`

`apps/mobile/app/index.tsx` keeps its cold-start onboarding gate, but is edited
to seed `["sessionUser"]` after its existing `saveSession`.

### 7. Optional helper

If `index.tsx` gets noisy, extract the meta `useQuery` hooks to
`apps/mobile/src/hooks/useHomeFeedMeta.ts`. Same keys, same fetchers. Not
required.

## Behavior after the change

| Moment | Network | UI |
|---|---|---|
| Open Feed (returning user) | `GET /v1/me/feed` immediately; meta starts after feed success | Spinner until feed JSON; greeting from auth-seeded cache when available |
| First Feed after onboarding | Feed immediately; circles/user/children use the captured draft | No extra circles wait regardless of which onboarding path entered Feed |
| After feed JSON | Image URLs | Photos fill in (unchanged) |
| Switch tab and back | none (within 30s staleTime) | Same list |
| Read a notification, back to Feed | none | Badge already updated via cache |
| Foreground push or app resume | notifications query invalidated | Badge refetches when query is enabled |
| Pull to refresh | feed + meta in parallel | RefreshControl |
| Realtime `post.new` | feed refetch | List updates |
| Sign out → another account | empty cache | No previous user’s posts |

## What not to change in this pass

- Home-feed Redis cache
- Discovery SQL
- Circle-feed N+1 author queries
- Image CDN / `PostMediaGallery`
- `REQUEST_TIMEOUT_MS` / GET retry
- Moving onboarding checks into `(app)/_layout.tsx`
- Making the Circles tab share `["circles"]`
- Passing `childrenQuery` into `HomeTourOverlay` (it still fetches children)
- Invalidating saved ids from the post-thread / circle-feed save buttons
- Invalidating `["sessionUser"]` from the avatar settings screen (background
  `api.me` on Feed with 30s staleTime is enough)
- Changing realtime to refetch only page 1

## Test plan

1. Cold start a completed parent: Feed spinner ends when posts arrive. Bell
   badge and bookmarks can appear a beat later. Greeting uses stored handle
   if `saveSession` already ran.
2. Charles / Proxyman on first Feed open: `GET /v1/me/feed` starts without
   waiting for `/v1/me`, `/v1/circles`, `/v1/me/children`,
   `/v1/me/notifications`, `/v1/me/saved`. On an unseeded run those metadata
   requests must start only after the feed succeeds.
3. Switch to Messages (or Circles) and back: list does not remount to
   “Loading your feed” and does not fire a new `/v1/me/feed` within 30s.
4. Pull to refresh: feed and badge/bookmarks update.
5. Compose / FAB: disabled or hidden until circles load; then opens the
   primary circle composer. Does not bounce to onboarding during the circles
   request.
6. Empty feed with circles: “Be the first to share…” not “Complete your
   profile”.
7. New post via realtime: list refreshes once.
8. Before the saved-id query succeeds, bookmark controls are disabled. After
   it succeeds, save/unsave updates the icon only after API success.
9. Home tour: does not show until user + circles are ready.
10. Completion prompt: can appear after cards, not before.
11. No token / 401 on feed: authenticated state and query cache are cleared,
    then login opens; no onboarding redirect or previous-user content.
12. Other feed error: retry empty state, not infinite spinner.
13. Provider accounts: still go to `/(provider)` from `app/index.tsx`.
14. Enter Feed through ready, children “Go to feed”, prompt-driven add/edit,
    and error recovery: available draft data is captured, draft is cleared,
    and there is no false bounce through children onboarding.
15. Sign out, sign in as a different parent: no leftover posts, circles, or
    bookmarks.
16. Open notifications, mark one (or all) read, back to Feed: badge count
    drops without pull-to-refresh.
17. Circles request fails: compose stays inert; does not open
    `/onboarding/children`.
18. Notifications or saved request fails: Feed still shows posts; badge 0;
    bookmarks outlined.
19. Login as another parent after an expired-session redirect, without an
    explicit sign-out: no feed, user, circles, or bookmarks from the previous
    account.
20. Receive a foreground push and resume the app from background: the
    notifications key is invalidated and the Feed badge catches up.
21. Add/edit/delete a child or change location from a completion prompt, then
    return to Feed: completion prompt and compose circles use refreshed data.
22. Simulate repeated 10-second timeouts: each Feed/meta query receives only
    the API wrapper’s two attempts, not a second React Query retry cycle.
