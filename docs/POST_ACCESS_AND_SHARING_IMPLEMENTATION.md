# Post access and sharing — end-to-end implementation

**Status:** implementation in progress in code; member posting/editing/commenting/voting is unchanged.

This is the authoritative implementation document for:

- questions posted into a circle by a parent who is not a member;
- access to that parent's own thread and its replies;
- member, outsider-author, discovery-preview, and share-preview permissions;
- sharing text, images, videos, and a short post URL;
- Android App Links, iOS Universal Links, login continuation, Open Graph previews, and store fallback.

The existing school-question flow and post-sharing code must be extended rather
than replaced with separate, incompatible systems.

---

## 1. Product rules

1. A circle remains private. A non-member cannot open its feed, member list, or
   unrelated posts.
2. A prospective parent may ask a question that is targeted to a school circle.
   The question appears in that circle, and members can reply.
3. The prospective parent can reopen their own question, read all replies,
   reply, edit it, and delete it. This does not make them a circle member.
4. Circle membership continues to come from the parent's profile. If their
   child, school, curriculum, grade, or location changes, existing membership
   synchronization decides which circles they join or leave.
5. A recipient opening a valid shared-post URL can see that one post. A share
   does not grant access to the circle.
6. Non-member share recipients get a read-only preview. They cannot comment,
   vote, mark helpful, browse the circle, or message members from that surface.
7. Every normal share uses one short HTTPS URL for Android and iOS:
   `https://vaara.ai/p/{shareId}`.
8. The default share is link-first. Rich images are supplied by the link's Open
   Graph page because OS-level media captions and URLs are inconsistent.

---

## 2. Verified current implementation

The codebase already has useful pieces:

- `circle_post_targets` allows one post to target one or more circles without
  making its author a member.
- `POST /v1/schools/:id/questions` creates a circle post for a prospective
  parent and records it in `school_questions`.
- `GET /v1/schools/questions/:questionId` lets only the asker fetch a reduced
  copy of that question and its replies.
- The standard post thread has a `readOnly` preview mode.
- Reply notifications are sent to the post author.
- The mobile application has a `vaara-parents://` custom scheme.
- Post media already supports images and videos.

The current pieces do not form a complete flow:

- General post creation rejects every target circle the author does not belong
  to.
- Standard thread GET deliberately excludes the outsider author from discovery
  access.
- Replies, edit, delete, and voting use circle membership as their guard.
- The outsider author's home feed cannot contain the post because it starts
  from the viewer's member circles.
- The reduced school-question GET is not used by the mobile app and does not
  return the full standard post model.
- Realtime subscriptions only support member-authorized circle channels.
- Reply notifications do not navigate to the post thread.
- Post sharing currently sends plain text only.
- No share-token API, short-post page, Universal/App Links, or per-post Open
  Graph page exists.

---

## 3. Problems and agreed solutions

### 3.1 Membership is being used for two different permissions

**Problem:** `assertCircleMember` correctly protects circle resources, but it
also blocks an outsider author from their own thread.

**Solution:** Add `resolveThreadAccess`, returning an explicit access state and
capabilities. Keep `assertCircleMember` for circle feed, members, mark-read, and
other circle-level resources.

### 3.2 Discovery access is broader than intended

**Problem:** `isDiscoveryPostReadable` currently allows any logged-in
non-member, other than the author, to read a post when they know its post and
circle IDs. It does not prove a legitimate discovery or share path.

**Solution:** Do not use knowledge of UUIDs as authorization. Discovery access
must be granted by the existing discovery-feed rules, while shared preview
access must require a valid opaque share token.

### 3.3 The school-question path is isolated

**Problem:** The school endpoint creates the right underlying circle post, but
the asker cannot use the standard thread experience.

**Solution:** Keep the school-question create endpoint as the product entry
point, return `circleId` and `postId`, and route the asker to the standard thread.
Make the old school-question GET a thin compatibility wrapper or deprecate it
after the mobile client migrates.

### 3.4 Outsider identity can be misrepresented

**Problem:** `buildAuthorView` may fall back to the author's first child and
show a curriculum/grade label that looks like membership in the target circle.
The current school-question body also embeds `[Prospective parent]` in user
content.

**Solution:** Store outsider status as structured context, not text in the post
body. Render the fixed label `Prospective parent · Not in this circle`. Do not
derive a target-circle context label for a non-member author.

### 3.5 The author cannot reliably find the thread

**Problem:** The post is absent from the outsider author's home feed. A reply
notification is currently the only practical route back.

**Solution:** Add `GET /v1/me/posts` and a `Your posts` screen. Return authored
posts regardless of current circle membership, including `circleId`,
`circleName`, `accessState`, `replyCount`, and post deep-link parameters.

### 3.6 Read-only mode conflates different users

**Problem:** The current boolean `readOnly` treats every non-member alike and
removes replies. That is correct for previews but wrong for the outsider author.

**Solution:** Return `accessState` and `capabilities`; use them to render the
thread. An outsider author gets the complete thread and author actions, while a
discovery or share recipient gets a limited preview.

### 3.7 Poll authors can be locked out of their own results

**Problem:** An outsider author must not vote in a circle poll, but
`hideUntilVote` can also prevent them from seeing the results.

**Solution:** Keep voting member-only and add an author-results override.
Minimum-vote privacy thresholds still apply.

### 3.8 Realtime replies do not reach outsider authors

**Problem:** the thread subscribes to `circle:{circleId}`, and the realtime
gateway authorizes that channel only for members.

**Solution:** Add `post:{postId}` channels. Authorize subscription only when the
viewer is the post author or a member of one of its target circles. Publish
reply changes to the post channel as well as existing circle channels.

### 3.9 Blocks and reports need thread-level enforcement

**Problem:** widening reply access without block checks could allow a blocked
outsider author and member to continue interacting in the thread.

**Solution:** Before creating or returning interactive replies, enforce
two-direction block rules. Keep report available for members and preview
recipients; authors cannot report their own post but can report replies.

### 3.10 Share behavior differs by platform

**Problem:** React Native's core share API sends text well, but it does not
reliably attach local media with a clickable caption on both Android and iOS.

**Solution:** Offer a link-first default and treat direct media sharing as a
separate option with documented limitations. Never promise that an attached
image/video and its clickable caption will both survive in every destination.

---

## 4. Thread access model

`resolveThreadAccess(client, { userId, circleId, postId, shareId? })` returns:

```ts
type ThreadAccessState =
  | "member"
  | "author"
  | "discovery_preview"
  | "share_preview"
  | "denied";

type ThreadCapabilities = {
  canViewPost: boolean;
  canViewReplies: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
  canMarkHelpful: boolean;
  canSave: boolean;
  canMessageAuthor: boolean;
  canOpenCircle: boolean;
};
```

Capabilities:

| Action | Member | Outsider author | Discovery preview | Share preview |
|---|---:|---:|---:|---:|
| View this post and media | Yes | Yes | Yes | Yes |
| View replies | Yes | Yes | No | No |
| Reply | Yes | Yes | No | No |
| Edit/delete own post | Yes | Yes | No | No |
| Vote / mark helpful | Yes | No | No | No |
| See poll results | Policy | Yes, threshold applies | Read-only policy | Read-only policy |
| Save | Yes | Yes | No in v1 | No in v1 |
| Message the post author | Existing policy | N/A | No | No |
| Open circle feed/member list | Yes | No | No | No |

Rules:

- `author` is established only by `circle_posts.author_id = userId`.
- `share_preview` is established only by a valid share token.
- `discovery_preview` is established only by an API-generated discovery result,
  not merely by supplying UUIDs.
- If the outsider later becomes a circle member, `member` takes precedence.
- API endpoints authorize the required capability, not the state name.

Endpoints that remain member-only:

- `GET /v1/circles/:circleId/feed`
- `GET /v1/circles/:circleId/members`
- `POST /v1/circles/:circleId/mark-read`
- poll vote/change/remove vote
- member-only circle notifications and realtime circle subscription

Endpoints that accept an outsider author:

- standard post-thread GET, including replies
- create a reply on their own thread
- edit their own post
- delete their own post
- fetch author-visible poll results

---

## 5. API changes

### 5.1 Standard post response

Extend the thread response:

```json
{
  "post": {},
  "replies": [],
  "accessState": "author",
  "capabilities": {
    "canViewReplies": true,
    "canReply": true,
    "canEdit": true,
    "canDelete": true,
    "canVote": false,
    "canOpenCircle": false
  }
}
```

The server remains authoritative. Mobile UI hiding is not authorization.

### 5.2 Your posts

Add:

```http
GET /v1/me/posts?before={cursor}&limit=20
```

The query starts from `circle_posts.author_id = currentUserId`, not
`circle_members`. Each item includes its primary target circle, reply count,
media preview, poll summary, `accessState`, and route parameters. Deleted or
moderated posts return a tombstone or are omitted according to moderation
policy.

### 5.3 School questions

Update:

```http
POST /v1/schools/:schoolId/questions
```

Response:

```json
{
  "questionId": "…",
  "circleId": "…",
  "postId": "…",
  "createdAt": "…"
}
```

Stop prefixing the stored post body with `[Prospective parent]`. Either derive
outsider status from membership at read time or add structured source metadata
if a durable source label is required.

### 5.4 Create a share

Add:

```http
POST /v1/posts/:postId/shares
Authorization: Bearer …
```

The caller must currently be allowed to view the full post. The API resolves a
target circle server-side and returns:

```json
{
  "shareId": "opaque-random-id",
  "url": "https://vaara.ai/p/opaque-random-id",
  "expiresAt": "…"
}
```

Prefer reusing one active token per `(postId, creatorId)` within a short window
instead of creating unlimited rows from repeated share-sheet opens.

### 5.5 Resolve a share

Add:

```http
GET /v1/shares/:shareId
Authorization: optional
```

Anonymous response contains only the fields approved for a shared preview:

- short body/poll preview;
- first media preview;
- post type;
- anonymous author presentation;
- generic or approved circle name;
- availability and expiry.

An authenticated member receives route resolution for the full thread. An
authenticated non-member receives `share_preview`. The endpoint never returns
the circle feed, member list, reply identities, or private profile fields.

---

## 6. Database changes

The core outsider-author access requires no new grant table: `author_id` and
`circle_post_targets` are sufficient.

Add a migration for share links:

```sql
CREATE TABLE post_shares (
  id text PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_shares_post_active
  ON post_shares(post_id, created_at DESC)
  WHERE revoked_at IS NULL;
```

Requirements:

- token IDs use at least 128 bits of cryptographic randomness;
- raw sequential IDs and post UUIDs are not public share IDs;
- token lookup is rate-limited;
- deleting/moderating the post invalidates the result immediately;
- block and visibility rules are reevaluated at resolve time;
- links have a configurable expiry, recommended 30 days for v1;
- the preview page uses `noindex, nofollow`.

---

## 7. Mobile changes

### Thread screen

Update `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`:

- render controls from `capabilities`;
- show complete replies and composer for `author`;
- show `Prospective parent · Not in this circle` for an outsider-authored post;
- show `You're not part of this circle` on share previews;
- prevent navigation from a preview banner into the circle;
- subscribe to the authorized post channel for outsider authors;
- use one centralized share helper.

### Your posts

Add a route such as:

```text
apps/mobile/app/(app)/profile/posts.tsx
```

Link it from the profile screen. It contains both normal authored posts and
prospective-school questions, with a visible `Not in this circle` marker where
appropriate.

### Login continuation

The app must store the unresolved URL when authentication is required:

```text
Tap link → app opens → no session
         → save pending URL
         → login/register
         → resolve pending URL once
         → member thread or shared preview
```

Clear the pending URL after successful navigation, logout, expiry, or an
invalid link. Validate the host and route before storing it.

### Notifications

Handle `circle_reply` in the notification center and push-open handler:

```text
/circles/{circleId}/posts/{postId}
```

The same standard thread route then resolves `member` or `author` access.

---

## 8. Sharing behavior

### 8.1 Recommended share menu

When the user taps Share:

1. **Share post** — recommended; preview text plus short clickable URL.
2. **Share media** — available when an image or video exists; shares the first
   media file, with caption/link only where the destination supports it.
3. **Copy link** — copies the same short HTTPS URL.

The app creates or retrieves the share URL before opening the OS share sheet.

### 8.2 Text-only post

Share payload:

```text
{trimmed post body or poll question}

Shared via Vaara Parents
https://vaara.ai/p/{shareId}
```

- cap preview text to a reasonable share length;
- do not expose the full text in the outgoing message if the post is long;
- Android receives the complete message with the URL inline;
- iOS may receive `message` and `url`, while the URL should still be included
  in fallback text for destinations that ignore the separate URL field.

### 8.3 Image post — default link share

Use the same text-and-link payload. The Open Graph page uses the first safe
image as `og:image`, so WhatsApp, Messages, Facebook, and similar destinations
can render a rich link card.

This is the only reliable cross-platform way to combine:

- a clickable post URL;
- branded marketing text;
- a visual preview;
- post-level routing and access checks.

Open Graph rendering is controlled by the destination. Vaara cannot guarantee
that every app will display the card or refresh a cached card immediately.

### 8.4 Image-only share

Download the image to the app cache and invoke a file-sharing library. The
current dependency list does not contain such a library; add a compatible Expo
sharing package or native share module during implementation.

Important limitation: an image-only share contains no clickable URL. Some apps
accept a caption, while others drop it. Therefore:

- `Share media` is explicitly secondary to `Share post`;
- attempt the short URL as a caption only on supported paths;
- never claim that the caption is guaranteed;
- optionally generate a branded image containing `Vaara Parents` and the short
  URL as visible text, but visible text is not the same as a clickable link.

If a clickable URL is mandatory, use **Share post**, not image-only sharing.

### 8.5 Video post

Default behavior remains link-first. The Open Graph card should use a generated
or stored video poster image. Do not promise inline video playback in WhatsApp
or every social network; recipients tap the URL to open the post.

`Share media` may download and attach the video, subject to:

- file-size limits of the destination app;
- download time and device storage;
- platform MIME-type support;
- the same unreliable caption/link behavior as image attachments.

Fallback to the link share if the download fails or exceeds the configured
size limit.

### 8.6 Multiple media items

V1 uses the first safe image or video poster in the Open Graph card and shares
at most one direct attachment. Multi-file sharing is deferred because platform
and destination behavior varies substantially.

### 8.7 Files

Circle posts currently model image and video media, not arbitrary documents.
Document/file attachment sharing is outside this implementation unless the
post-media model is expanded separately.

---

## 9. Short URL, web page, and Open Graph

Canonical public link:

```text
https://vaara.ai/p/{shareId}
```

Use one exact canonical host for links and association files. The recommendation
is the apex `vaara.ai`; do not redirect `/p/*` through `www` before Universal
Link/App Link handling. If infrastructure requires `www`, choose it everywhere
instead.

The current web app is a static Vite application. Social crawlers usually do not
execute its JavaScript, so `/p/:shareId` requires a Vercel serverless/edge route
or server-rendered response containing per-share tags:

```html
<meta property="og:title" content="A parent shared a post on Vaara Parents">
<meta property="og:description" content="Short, privacy-reviewed preview">
<meta property="og:image" content="HTTPS image-preview URL">
<meta property="og:url" content="https://vaara.ai/p/{shareId}">
<meta property="og:type" content="article">
<meta name="robots" content="noindex,nofollow">
```

The preview image URL must be reachable by approved crawlers without app
authentication. Possession of the opaque share URL is therefore a bearer grant
to the limited preview. Never place private storage keys or permanent unsigned
object URLs in the HTML.

Human web response:

- show a minimal post preview and `Open in Vaara Parents`;
- Android fallback links to Google Play;
- iOS fallback links to the App Store;
- desktop shows a QR code and both store choices;
- unavailable, expired, deleted, blocked, or moderated links show a neutral
  `This post is no longer available` page.

---

## 10. Android and iOS linking

Configure links in Expo configuration, not by editing generated native files.
Build profiles run prebuild and may overwrite direct native edits.

### Android

Add an HTTPS `android.intentFilters` entry for the canonical host and `/p`
prefix. Serve:

```text
https://vaara.ai/.well-known/assetlinks.json
```

It must contain `com.vaara.parents` and the SHA-256 fingerprint of the
production EAS signing certificate.

### iOS

Add:

```text
applinks:vaara.ai
```

to `ios.associatedDomains`. Serve:

```text
https://vaara.ai/.well-known/apple-app-site-association
```

with the production Apple Team ID, bundle identifier `com.vaara.parents`, and
the `/p/*` path rules.

### App not installed

An HTTPS Universal/App Link naturally opens the web fallback and store page.
It does **not** automatically preserve the post through a fresh installation.
For v1, tell the recipient to return to or tap the same link after installing.
True deferred deep linking requires a separately selected provider or a
first-party attribution mechanism and must not be claimed until tested.

---

## 11. Realtime changes

Add in `packages/redis/src/channels.ts`:

```ts
export function postChannel(postId: string): string {
  return `post:${postId}`;
}
```

Add a post-event publisher in `packages/redis/src/pubsub.ts`. Publish
`reply.new`, post edits, and post deletion to that channel where useful.

Update `apps/realtime/src/index.ts` so `post:{postId}` subscription checks:

```sql
SELECT 1
FROM circle_posts p
WHERE p.id = $1
  AND (
    p.author_id = $2
    OR EXISTS (
      SELECT 1
      FROM circle_post_targets pct
      JOIN circle_members cm ON cm.circle_id = pct.circle_id
      WHERE pct.post_id = p.id AND cm.user_id = $2
    )
  )
```

Knowing a post ID is never sufficient to subscribe.

---

## 12. Code-change inventory

### API

- `apps/api/src/lib/author.ts`
  - add thread access resolution or a dedicated access module;
  - remove misleading outsider context fallback.
- `apps/api/src/routes/circles.ts`
  - use capabilities for thread GET/reply/edit/delete;
  - retain member-only guards for circle resources and votes;
  - return explicit `accessState` and `capabilities`;
  - enforce block checks.
- `apps/api/src/routes/schools.ts`
  - return standard thread identifiers;
  - stop altering body text with an outsider prefix;
  - migrate or wrap the reduced question GET.
- `apps/api/src/routes/me.ts`
  - add paginated `GET /posts`.
- `apps/api/src/routes/shares.ts` or equivalent
  - create and resolve share tokens;
  - return limited preview data.
- `apps/api/src/lib/polls.ts`
  - allow the author to see results without voting while retaining thresholds.
- `apps/api/src/services/feed.ts`
  - replace UUID-knowledge discovery authorization with scoped access proof.
- `apps/api/src/services/notifications.ts`
  - retain reply notifications and ensure route data includes circle/post IDs.

### Mobile

- `apps/mobile/src/lib/api.ts`
  - add access/capability types, your-posts API, and share APIs.
- `apps/mobile/src/lib/share-post.ts`
  - centralize platform payloads, URL creation, and media fallback.
- `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`
  - render capability-driven thread states and use centralized sharing.
- `apps/mobile/app/(app)/index.tsx`
  - replace local text-only sharing with centralized sharing.
- `apps/mobile/app/(app)/profile.tsx`
  - link to `Your posts`.
- `apps/mobile/app/(app)/profile/posts.tsx`
  - add authored-post history.
- `apps/mobile/app/(app)/notifications/index.tsx`
  - navigate reply notifications to the thread.
- `apps/mobile/app.json`
  - add Android intent filters and iOS associated domains.
- authentication/session routing
  - preserve and resume a validated pending post URL.

### Realtime and shared packages

- `packages/redis/src/channels.ts`
- `packages/redis/src/pubsub.ts`
- `apps/realtime/src/index.ts`

### Web

- `apps/web`
  - add server-rendered `/p/:shareId`;
  - add Open Graph tags and human fallback;
  - serve both `.well-known` association files without redirects.

### Database

- add the `post_shares` migration and indexes.

---

## 13. Delivery phases

### Phase 1 — Correct thread permissions

- implement access state and capabilities;
- integrate the school-question flow with standard threads;
- fix outsider author labels;
- allow author read/reply/edit/delete;
- keep voting and circle browsing member-only;
- enforce blocks.

### Phase 2 — Retrieval and live updates

- add `Your posts`;
- add notification deep links;
- add post-author poll result access;
- add authorized per-post realtime.

### Phase 3 — Short link and link-first sharing

- add share-token migration and APIs;
- centralize mobile sharing;
- ship text + URL and Copy Link;
- add authenticated member and non-member preview routing.

### Phase 4 — Web, Open Graph, and platform links

- server-render `/p/:shareId`;
- configure Android App Links and iOS Universal Links;
- serve association files;
- support store and desktop fallback;
- verify rich previews in major destinations.

### Phase 5 — Direct media sharing

- add the selected native sharing dependency;
- implement first-image and first-video attachment;
- enforce download/file-size limits;
- retain link-first fallback;
- optionally add branded share-card rendering.

---

## 14. Verification plan

### Authorization tests

- member gets full thread and circle access;
- outsider author gets full own thread but cannot open the circle;
- unrelated logged-in user cannot open arbitrary UUIDs;
- valid share token gives limited preview only;
- expired/revoked token gives unavailable response;
- blocked users cannot continue replying to each other;
- outsider author cannot vote or mark helpful;
- outsider author can see threshold-safe poll results;
- author becoming a member automatically receives member capabilities.

### Mobile tests

- school question navigates to its standard thread;
- outsider author reopens it from `Your posts`;
- reply notification opens the correct thread;
- login resumes the pending shared link;
- previews never expose circle navigation or interactive controls;
- invalid links fail safely.

### Sharing tests

- text-only post shares preview and one short URL;
- image post link produces an image card where the destination supports OG;
- image-only sharing attaches a file and does not promise a clickable caption;
- video link uses a poster and opens the correct post;
- failed/large media attachment falls back to link sharing;
- Android and iOS use the same canonical HTTPS URL;
- WhatsApp, Messages/iMessage, Facebook, email, and generic system share are
  tested on physical devices;
- OG cache refresh behavior is documented for support.

### Link tests

- installed Android app opens `/p/*`;
- installed iOS app opens `/p/*`;
- logged-out app resumes after authentication;
- no-app Android opens Play Store fallback;
- no-app iOS opens App Store fallback;
- desktop shows web fallback;
- `.well-known` files return `200`, correct content type, and no redirect.

---

## 15. Acceptance criteria

- Circle feeds remain inaccessible to non-members.
- Prospective parents can access and participate in only their own questions.
- Members see outsider posts clearly labelled without false profile context.
- All authorization is enforced server-side through capabilities.
- Arbitrary post/circle UUID knowledge grants no access.
- `Your posts` makes every authored outsider thread recoverable.
- Reply notifications and realtime updates work for outsider authors.
- Default sharing includes preview text, Vaara branding, and one short post URL.
- A shared URL opens the exact post or its limited preview after access checks.
- Image/video posts have an OG visual preview where supported.
- Direct media-only sharing is available as a secondary option with safe
  fallback and no false promise about clickable captions.
- Android and iOS use the same HTTPS URL and verified platform association.
- Deleted, moderated, blocked, expired, and revoked content fails closed.

---

## 16. Decisions to confirm before implementation

1. Canonical host: recommended `vaara.ai`, used without redirect for `/p/*`.
2. Share-link expiry: recommended 30 days, reusable until expiry or revocation.
3. Preview circle name: full display name or generic `a parent circle`.
4. Preview poll results: recommended options visible, counts visible only after
   the existing minimum-vote threshold.
5. Direct-media dependency: select after validating Expo 52 compatibility.
6. Deferred install linking: v1 requires retapping the link; provider selection
   is a separate product and privacy decision.

