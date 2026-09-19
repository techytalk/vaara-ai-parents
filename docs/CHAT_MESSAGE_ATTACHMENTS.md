# Attachments in chat messages

**Status:** Implemented end-to-end (API + mobile). Spec remains the source of
truth for behavior. Apply migration `053` before relying on hardened
constraints in a new environment.

**Read the [§12 decision log](#12-decision-log) first.** It records the six
resolved scope decisions and the facts already verified against production, so
they are not re-litigated during implementation.

**Decision:** A message is the single compose primitive. A parent may type text,
attach photos, video, or documents, or send attachments without text. There is
no separate Post or Ask mode inside a group. The same composer and attachment
behavior applies to a circle channel and to replies inside a thread.

This extends the Slack-style model in
[`SLACK_STYLE_THREADS.md`](./SLACK_STYLE_THREADS.md). It reuses the existing
post attachment picker, upload, validation, document scanning, and rendering
work described in
[`POST_DOCUMENT_ATTACHMENTS.md`](./POST_DOCUMENT_ATTACHMENTS.md), but chat
messages remain `circle_messages`; they are not converted into posts.

---

## 1. Product model

### 1.1 One composer, all message types

The composer stays:

```
[ + ]  Message                                      [ send ]
```

Tapping `+` opens an attachment sheet:

```
Photos & videos
Document
```

The user does not choose “post,” “question,” “announcement,” or “ask.” Meaning
comes from the content:

- “Hi” is a normal channel message.
- “Does anyone have the timetable?” is also a normal channel message.
- Four sports-day photos are one message with four attachments.
- A fee circular PDF may be sent with or without accompanying text.
- Any channel message can become a thread root when someone taps Reply in
  thread.
- A thread reply supports the same attachments as a channel message.

There is no topic/title field and no attachment-specific thread heading.

### 1.2 Initial scope

The first implementation covers:

- circle channel messages;
- replies inside Slack-style circle threads;
- member authors;
- guest authors/repliers where the existing thread grant permits sending;
- images, videos, PDF, `.docx`, and `.xlsx`;
- mixed text + attachments and attachment-only messages;
- multiple selection;
- upload progress, retry, removal, and failed-file states;
- rendering, opening, downloading, reactions, replies, moderation, and
  deletion.

Direct messages should use the identical user experience, but require a
parallel `direct_message_media` relation and DM access checks. Build that as
the next slice rather than coupling it to the circle-message release.
Provider channel broadcasts stay out of scope; they are authored content, not
the parent chat composer.

### 1.3 Limits reused from posts

Keep existing server limits for the first release:

- up to **4 photos/videos combined** per message (`MAX_POST_MEDIA`);
- up to **3 documents** per message (`MAX_POST_DOCUMENTS`);
- image: **10 MB each**;
- video: **100 MB each**, with the mobile picker capped at **120 seconds**;
- PDF: **20 MB each**;
- `.docx` / `.xlsx`: **10 MB each**;
- documents with macros, archives, executables, APKs, and renamed binaries are
  rejected under the existing document rules.

These limits are independent, matching the current post contract. A future
product decision may replace them with one unified attachment cap.

---

## 2. Mobile UI/UX

### 2.1 Closed composer

```
┌──────────────────────────────────────────────┐
│  +   Message                           ➤     │
└──────────────────────────────────────────────┘
```

- Replace the removed `?` action with a neutral `+` or paperclip.
- `+` is always visible when the user can reply.
- Send is enabled when trimmed text is non-empty **or** at least one clean
  attachment is ready.
- Long or multiline text expands the composer as it does today.
- Accessibility label: `Add attachment`.

### 2.2 Attachment sheet

```
┌──────────────────────────────────────────────┐
│ Add to message                         Done  │
│                                              │
│  [ image ]  Photos & videos                  │
│             Choose up to 4                   │
│                                              │
│  [ file  ]  Document                         │
│             PDF, Word, or Excel              │
└──────────────────────────────────────────────┘
```

Use a bottom sheet or compact modal. Do not navigate to a new compose screen:
the draft and keyboard context remain attached to the current conversation.

The media row launches `expo-image-picker` with:

- images and videos;
- `allowsMultipleSelection: true`;
- `selectionLimit` equal to remaining capacity;
- `quality: 0.85`;
- `videoMaxDuration: 120`.

The document row launches `expo-document-picker` with multiple selection and
the existing PDF/Word/Excel MIME allowlist.

Camera capture is not in this release because the existing post flow does not
implement it. It can be added as a third action later.

### 2.3 Selected attachment tray

Selected items appear above the text input, without leaving chat:

```
┌──────────────────────────────────────────────┐
│ [photo ×] [photo ×] [video 0:18 ×]           │
│ [PDF] Term_1_Circular.pdf · Checking…    ×   │
│                                              │
│  +   Add a note…                       ➤     │
└──────────────────────────────────────────────┘
```

Behavior:

- photos/videos use a horizontal thumbnail strip;
- video thumbnails show a play badge and duration;
- documents use a compact filename/type/size row;
- each pending item has a remove control;
- `Add a note…` replaces `Message` when attachments exist;
- selection order becomes display order;
- selecting more appends up to the remaining limit;
- the draft survives picker cancellation and individual upload failures.

### 2.4 Upload timing and send behavior

Start uploads immediately after selection. This is better for chat than
waiting until Send because the user can type while uploads finish.

Per-item states:

1. `preparing` — resolving a stable local URI;
2. `uploading` — show progress if available, otherwise a spinner;
3. `scanning` — documents only, label `Checking file…`;
4. `ready` — removable and sendable;
5. `failed` — inline reason plus Retry and Remove;
6. `blocked` — inline safety explanation; item is excluded from Send.

Send rules:

- Send remains disabled while any retained item is preparing, uploading, or
  scanning.
- Failed/blocked items do not silently disappear. The user must Retry or
  Remove them before sending.
- When all retained items are ready, one tap creates one message containing
  the text and ordered attachment metadata.
- Show one optimistic bubble with `Sending…`; never one bubble per file.
- `clientMessageId` makes retries idempotent. Retrying after a timeout must
  return the original message and attachment rows, not duplicate either.
- On API failure, retain local draft and uploaded keys; show Retry. Do not
  force the user to re-pick files.

### 2.5 Sent-message layout

#### Photos

- one image: full-width rounded preview;
- two images: two equal tiles;
- three images: one large tile plus two stacked tiles;
- four images: 2 × 2 grid;
- tap opens a full-screen gallery at that image;
- swipe between all photos/videos in the message (new component — see the gallery
  plan below).

#### Video — phased plan

The app has no video player and no thumbnail generator. `expo-av`, `expo-video`,
`expo-video-thumbnails`, and `expo-image` are all absent from `package.json`, and
`PostMediaGallery` only calls `Linking.openURL`. Video therefore splits across
two releases along the OTA boundary.

**Phase 1 — ships with attachments, OTA-safe:**

- a neutral tile with a centred play badge, sized like an image tile in the grid;
- the real duration as a corner badge. This is free: `expo-image-picker` already
  returns `asset.duration` in milliseconds, and `new-post.tsx` already forwards it
  as `durationMs`. Persist it to `circle_message_media.duration_ms` on send and
  render `m:ss`;
- tap calls `Linking.openURL` with the inline-disposition signed URL from §4.6.1,
  so the OS or browser plays it — the same handoff posts use today;
- no autoplay, no in-app playback.

The honest cost of Phase 1: a plain tile is a weaker preview than WhatsApp's, and
playback bounces the user out of the app. Acceptable for a first release, and it
requires no store build.

**Phase 2 — needs a store build, plan as a separate release:**

| Capability | Dependency | Extra work |
|---|---|---|
| Poster frame | `expo-video-thumbnails` | Generate at pick time, upload as a second object, and add a `poster_storage_key` column to `circle_message_media` — the table has no poster column today |
| Inline playback and mute/silent handling | `expo-video` | Player surface inside the gallery; respect the iOS silent switch |
| Efficient cached remote images | `expo-image` | Would also let §4.6.1 relax its URL-stability constraint |

Generate posters **client-side at pick time**, not server-side: there is no ffmpeg
or transcoding Lambda in this stack, and adding one for thumbnails alone is
disproportionate. Bundle all three dependencies into one store build rather than
shipping three.

#### Full-screen gallery — Phase 1, no new dependency

There is no lightbox to reuse; `PostMediaGallery` delegates to `Linking`. Build a
chat-specific viewer from `Modal` plus a horizontally paged `FlatList`
(`pagingEnabled`, `getItemLayout` for correct initial index), opening at the
tapped item and swiping across all media in that message. Videos appear in the
same pager as Phase 1 tiles until `expo-video` lands.

Build this for chat only. Do not refactor `PostMediaGallery` to share it — posts
work today, and coupling the two doubles the regression surface for no user gain.
If the viewer slips, fall back to `Linking.openURL` for images too rather than
delaying the release.

#### Documents

Render below media and above message time/actions:

```
┌──────────────────────────────────────┐
│ [PDF] Term_1_Circular.pdf            │
│       PDF · 1.4 MB            Open   │
└──────────────────────────────────────┘
```

Reuse the visual language and MIME labels from `PostDocumentList`, but extract
a generic `DocumentAttachmentList` so post and chat access callbacks differ.

#### Mixed content

Within one bubble:

1. photo/video gallery;
2. document rows;
3. text caption;
4. edited/time status;
5. reactions and message actions outside the bubble as today.

Attachment-only messages omit the empty text block.

### 2.6 Threads, quote replies, and forwarding

- Reply in thread carries the complete root message. Its attachment preview
  remains visible at the top of the thread.
- Thread replies use the same attachment tray and limits.
- Reply in channel/quote preview shows a thumbnail or file icon plus:
  `Photo`, `Video`, or the document filename when body text is empty.
- `N replies` remains on the root message; attachment count does not affect
  reply count.
- Forwarding is out of scope. The OS share action for a document remains an
  explicit user action after authenticated download.

### 2.7 Editing and deletion

For v1:

- editing changes message text only;
- attachments are immutable after Send;
- a user can delete the whole message under existing delete rules;
- deleting a message hides its text and attachments together;
- backend cleanup deletes stored objects asynchronously after the DB
  transaction commits;
- moderation hides all attachments immediately, even if object deletion is
  delayed.

Allowing add/remove/reorder during message editing creates substantially more
failure and audit states and should be a later decision.

### 2.8 Accessibility

- Every picker row and remove/retry/open control has an accessibility role and
  label.
- Thumbnail labels include position and type: `Photo 2 of 4`.
- Upload state changes announce politely without moving focus.
- Do not encode upload state by color alone.
- Document names truncate visually but remain complete in accessibility text.
- Touch targets are at least 44 × 44 points.

---

## 3. Existing foundation to reuse

### 3.1 Already present

Database migration `045_circle_messages_and_reads.sql` already created
`circle_message_media` with:

- `message_id`;
- `storage_key`;
- `media_type`;
- `mime_type`;
- `size_bytes`;
- width, height, and duration;
- `file_name`;
- `scan_status`;
- `sort_order`.

No new circle-message attachment table is required.

Note what is and is not shared. Chat attachments do **not** write to
`circle_post_media`; posts and messages keep separate media tables with the same
column shape, each with its own foreign key and cascade. That is deliberate — a
single shared table would need a nullable polymorphic parent, which gives up
referential integrity and cascade-on-delete for both sides. What is genuinely
shared is everything below the table: one S3 bucket, one presigned-upload route,
one validation path, one GuardDuty scanning pipeline, and one set of mobile
picker/upload helpers.

The read path is the one place sharing would be wrong: post media is served from
permanent public CDN URLs, and chat media must be access-checked (§4.0, §4.6.1).

The existing post implementation already provides:

- S3 presigned PUT creation in `apps/api/src/routes/media.ts`;
- image/video validation and `verifyUploadedMedia` in
  `apps/api/src/lib/media-storage.ts`;
- document quarantine, format/magic-byte checks, macro rejection, scanning,
  and promotion;
- multi-photo/video picker code in
  `apps/mobile/app/circles/[circleId]/new-post.tsx`;
- stable local URI and byte upload helpers in
  `apps/mobile/src/lib/media-local.ts`;
- document state machine in `apps/mobile/src/lib/document-upload.ts`;
- document rendering/opening behavior in
  `apps/mobile/src/components/circles/PostDocumentList.tsx`.

### 3.2 Reuse by extraction, not copy/paste

Extract shared units before wiring chat:

- `PendingAttachment` and upload states;
- `pickMedia(remaining)` and `pickDocuments(remaining)`;
- `uploadMediaItems` with concurrency 2;
- `uploadAndScanDocument`;
- thumbnail tray;
- generic document list/card;
- file-size and MIME labels.

The sent-message gallery is **not** on that list. `PostMediaGallery` renders a
simple row and delegates opening to `Linking`; the multi-image grid layouts in
§2.5 and any in-app viewer are new components. Build them for chat first and
leave posts alone rather than trying to generalize one component across both.

Post and chat then supply their own final create request and authenticated
download resolver.

---

## 4. API contract

### 4.0 Storage prefixes — decided, with the required code fixes

**Decision: photos and videos get a new `chat-media/` prefix. Documents keep the
existing `quarantine/` → `post-docs/` path unchanged.**

This is not a preference. `circle-media/*` is deliberately **public**:
`createMediaUpload` returns `publicUrl: mediaPublicUrl(storageKey)`, posts render
straight from that CloudFront URL with no auth, and
[`S3_MEDIA_SETUP.md`](./S3_MEDIA_SETUP.md) §3 specifies a CloudFront behaviour
that serves `circle-media/*` and `listing-media/*` and **403s every other path**.
So writing chat photos to `circle-media/` would make every school photo
permanently fetchable by anyone holding the URL, and would hand the client that
public URL at upload time. Reusing the prefix cannot be made private later
without moving objects.

The same CloudFront rule is why a new prefix is cheap: `chat-media/*` falls
outside the allow-list and is therefore **private by default**, with no new CDN
configuration. Reads go through presigned S3 GET (§4.6).

Documents are the opposite case. They are already private — promoted to
`post-docs/` after scanning, never served from the CDN, downloaded only via
short-lived presigned GET. A `chat-docs/` prefix would buy nothing and would cost
a new CloudFront deny path, a new lifecycle rule, and a second scan-promotion
branch. Keep one document namespace; only the *naming* is post-flavoured.

#### Exact call sites to change

| Location | Change |
|---|---|
| `createMediaUpload` | Add `scope: "circle" \| "chat"` (default `circle`). When `chat`, write `chat-media/{userId}/` and **omit `publicUrl` from the response**. Document uploads keep `quarantine/`, unchanged. |
| `verifyUploadedMedia` | Accept `chat-media/{userId}/` in addition to `circle-media/{userId}/`. Keep the per-user ownership assertion for both. |
| `mediaPublicUrl` | Throw on any key starting with `chat-media/`. A public URL for chat media is always a bug; fail loudly instead of leaking. |
| `deleteStoredMedia` | Add `chat-media/` to the prefix allow-list. **Without this every chat object leaks silently** — the function filters unknown prefixes out and returns without error, so there is no exception and no log line, only an S3 bill. |
| `verifyCleanDocumentForPost` | Rename to `verifyCleanDocument`. Prefix logic unchanged (`post-docs/{userId}/`). Renaming matters so chat does not call a post-named function with a chat message ID. |
| `resolveDocumentScanStatus`, `createDocumentDownloadUrl` | No change. Both already work for any user's `post-docs/` key; chat calls them as-is behind a chat access check. |

Two regression tests are worth writing at the same time, because both failure
modes are silent: one asserting a `chat-media/` key reaches
`DeleteObjectsCommand`, and one asserting `mediaPublicUrl` throws for a
`chat-media/` key.

Ops note: the CloudFront deny behaviour described in `S3_MEDIA_SETUP.md` §3 is
listed there as a **pending** manual step. Confirm it is actually deployed before
release. If it was never applied, `chat-media/` is publicly fetchable and this
whole decision silently reverts to the unsafe option.

**IAM (required for chat uploads):** the API credentials used by Vercel must
allow `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on
`arn:aws:s3:::vaara-parents-connect/chat-media/*`. Without PutObject, the app
still receives a presigned URL but the phone’s PUT returns 403 and no row is
written to `circle_message_media`. Full policy JSON, console steps, CLI smoke
tests, and the CloudFront OAC privacy check live in
[`S3_MEDIA_SETUP.md`](./S3_MEDIA_SETUP.md) §2.

### 4.1 Message create

Extend both:

- `POST /v1/circles/:circleId/messages`;
- `POST /v1/threads/:threadId/messages`.

Request:

```ts
{
  body?: string;
  clientMessageId: string;
  replyToMessageId?: string;
  asProvider?: boolean;
  attachments?: Array<{
    storageKey: string;
    mediaType: "image" | "video" | "document";
    mimeType: string;
    fileName?: string;
    width?: number;
    height?: number;
    durationMs?: number;
  }>;
}
```

Note the deliberate divergence from the post API: posts take **two** arrays
(`media` and `documents`, validated against `MAX_POST_MEDIA` and
`MAX_POST_DOCUMENTS` separately), while a chat message takes **one** ordered
`attachments` array. One array matches how the composer works — selection order is
display order across mixed types. The server splits it by `mediaType` on receipt
and then reuses the existing per-type verification and limits unchanged, so this
costs one partition step and no duplicated validation.

Server requirements:

- require text or at least one valid attachment;
- enforce counts and byte limits again;
- verify key ownership from the authenticated user prefix;
- verify every image/video with `HeadObject`;
- verify every document is clean and promoted;
- ignore client-provided byte size;
- reject duplicate storage keys in one request;
- insert message and all `circle_message_media` rows in one transaction;
- return the fully hydrated message with attachments;
- preserve current circle/thread/grant/blocked-user checks.

### 4.2 Idempotency

`UNIQUE (author_id, client_message_id)` already protects the message. Complete
the contract:

- if the message exists, load and return its existing attachments;
- never insert new attachment rows on a replay;
- reject a replay whose circle/thread destination differs;
- optionally reject a replay whose requested attachment key set differs, and
  log it as a client bug.

### 4.3 Response type

Extend `ChatMessage`:

```ts
attachments: Array<{
  id: string;
  type: "image" | "video" | "document";
  mimeType: string;
  sizeBytes: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string | null;
}>;
```

Always return `attachments: []` for old messages. This avoids optional-shape
branches across optimistic updates, realtime catch-up, and renderers.

### 4.4 Reads and realtime

Hydrate attachments in:

- channel pagination;
- thread pagination;
- message-create response;
- idempotent replay response;
- any root-message payload used by thread detail;
- notification/quote preview generation where needed.

Avoid one query per message. Fetch attachment rows for the page’s message IDs
in one ordered query and attach them by `message_id`.

Realtime events may remain lightweight (`messageId`, destination, sequence).
Receivers already catch up through the canonical list endpoint, which then
returns attachments. Optimistic local state uses the full create response.

### 4.4.1 Preview text breaks on attachment-only messages

This is the gap most likely to reach production unnoticed, because it is a
regression in screens the attachment work never touches. Every preview path in
`services/chat.ts` reads message text only:

- `listInbox` selects `m.body AS preview` for channels and
  `COALESCE(t.title, t.body)` for threads;
- `listLinearMessages` builds `last_reply_preview` from `LEFT(r.body, 80)`;
- `previewText(body, title)` feeds Home rows and thread lists;
- push/notification payloads derive from the same text.

An attachment-only message therefore produces a blank inbox row, a blank Home
snippet, and a blank “last reply” line. Fix this server-side, in one shared
helper, so every surface agrees:

- text present → current behavior;
- text empty, media present → `Photo`, `Photos (3)`, or `Video`;
- text empty, documents only → the sanitized file name, or `Document (2)`;
- mixed → text wins; attachment count is not appended.

Implement it as one helper used by inbox, home, thread lists, reply previews,
and notifications, and ship it with the read path (release step 4), before the
composer can create such messages.

### 4.5 Downloads and access

Do not expose chat documents through the existing post-only
`GET /v1/media/:mediaId/download` query; it reads `circle_post_media`.

Add a chat-aware route, for example:

```
GET /v1/chat/media/:mediaId/download
```

It must:

1. load `circle_message_media` plus the parent message;
2. resolve channel membership or thread grant using current chat access;
3. return 404/403 after revocation, block, deletion, or moderation;
4. issue a short-lived presigned GET with safe `Content-Disposition`;
5. never return a permanent document URL.

### 4.6 Photos and videos: privacy correction

The post pipeline serves images/videos from permanent public CDN URLs.
Blindly copying that read path into chat would let anyone with a leaked URL
retain access after leaving a circle or losing a thread grant.

Production contract:

- reuse the existing presigned upload and validation path;
- store chat image/video objects under `chat-media/`, which is private by default
  (§4.0);
- return signed S3 GET URLs only after chat access checks, on the TTL contract in
  §4.6.1;
- refresh expired URLs through the chat media endpoint;
- keep public post media behaviour unchanged.

Reusing `circle-media/` is explicitly rejected, not deferred: those objects are
CDN-public, so no amount of API-side access checking would make them private.

### 4.6.1 Signed URL mechanism and TTL contract

**Use S3 presigned GET, not CloudFront signed URLs.** CloudFront signing needs a
public key, a key group, and a private key in the API environment. None of that
exists — the codebase has only `getSignedUrl` from
`@aws-sdk/s3-request-presigner`, already used by `createDocumentDownloadUrl`.
Adding CloudFront signing is a separate infrastructure task, not a prerequisite
for this feature.

The problem with naive presigning is client caching. React Native's `Image`
caches by URL string, and `expo-image` is not installed, so if the signature
changes on every list fetch then every photo re-downloads on every scroll-back
and every reconnect. On Indian mobile data that is both a visible flicker and a
real cost.

Fix it by **quantising the signing time** so the same object yields a
byte-identical URL for everyone within a window:

```ts
const WINDOW_SECONDS = 3600;   // signature changes hourly
const TTL_SECONDS = 7200;      // URL stays valid for 2 hours

const bucketStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
const url = await getSignedUrl(s3, new GetObjectCommand({ ... }), {
  expiresIn: TTL_SECONDS,
  signingDate: new Date(bucketStart * 1000),
});
```

`signingDate` is part of `RequestPresigningArguments`, so this needs no new
dependency. Because it is derived from the clock rather than a random nonce, every
API instance produces the same URL for the same key — cache hits survive
horizontal scaling and app restarts.

The resulting contract:

- **Images and videos:** URLs are issued inline with list responses, valid 1–2
  hours (a URL minted at the end of a window still gets a full hour). Never set
  `Content-Disposition: attachment` — inline `ResponseContentType` lets the OS
  view or play the file. S3 supports range requests, which iOS Safari needs for
  video seeking.
- **Documents:** unchanged from the post behaviour — fetched on demand through
  the chat download route, TTL 60 seconds, `attachment` disposition. Documents are
  opened deliberately rather than rendered in a list, so there is no caching
  argument for a long TTL.
- **Revocation is not instant for media.** A member removed from a circle keeps
  any image URL already in their app until it expires, up to two hours. Document
  that window honestly rather than implying immediate cutoff; tighten
  `WINDOW_SECONDS` if product wants a shorter tail, accepting the bandwidth cost.

Cost note: presigned GET goes to the S3 endpoint directly, bypassing CloudFront,
so chat media reads are billed as S3 egress with no edge caching and higher
latency than post media. That is acceptable at current volume (zero media rows
today) and is the main reason to revisit CloudFront signed URLs — or signed
cookies, which would restore edge caching for a whole conversation at once — once
chat media traffic is material.

---

## 5. Storage and lifecycle

Prefixes, per the §4.0 decision:

```
chat-media/{userId}/{uuid}.{ext}   // new: chat photos and video, private
quarantine/{userId}/{uuid}.{ext}   // unchanged: document intake
post-docs/{userId}/{uuid}.{ext}    // unchanged: clean documents, post and chat
```

Clean documents keep promoting to `post-docs/`. The name is post-flavoured, but
the prefix is already private, already excluded from the CDN, and already covered
by the scan-promotion and lifecycle rules — a parallel `chat-docs/` would
duplicate all of that for no privacy gain. Rename the *function*, not the prefix.

Object lifecycle:

- abandoned upload: sweep objects not referenced after 24 hours;
- message deleted/moderated: revoke reads immediately, enqueue object cleanup;
- retry/replay: new chat uploads should map to only one final attachment row;
- failed/blocked document: destroy under the existing safety pipeline;
- account deletion: include `circle_message_media` keys in storage cleanup.

Shared-key caveat (currently theoretical — see §6.1, all media tables are empty
in production): migration `050` was written to copy existing post storage keys
into `circle_message_media`, which would let one object be referenced by both
`circle_post_media` and a message row. Since no such rows exist, this is not a
migration blocker, but keep cleanup reference-aware anyway so a future backfill
or a copy/forward feature cannot delete a live object. Check all attachment
relations before deleting S3 content:

- `circle_post_media`;
- `circle_thread_media`;
- `circle_message_media`;
- future `direct_message_media`.

Deleting a message may delete/hide its DB relation immediately, but the object
is deleted only when no remaining relation references that key.

**`deleteStoredMedia` silently ignores unknown prefixes.** It only deletes keys
under `circle-media/`, `listing-media/`, `quarantine/`, and `post-docs/`, and
filters anything else out without error. Adding `chat-media/` to that allow-list
is therefore not optional housekeeping: skip it and every chat photo and video
leaks forever, with no exception and no log line, only an S3 bill. Ship it in the
same change as the prefix (§4.0), with a test asserting a `chat-media/` key
actually reaches `DeleteObjectsCommand`.

---

## 6. Data integrity and migrations

`circle_message_media` exists and already covers v1, so a migration is optional.
Verified against migration `045`: it has `duration_ms int`, `width`, `height`,
`file_name`, a `scan_status` check (`pending`/`clean`/`blocked`/`failed`, defaulting
to `clean`), `sort_order`, `ON DELETE CASCADE` from `circle_messages`, and
`UNIQUE (message_id, storage_key)`. Migration `049` added positive-size and
non-negative-sort checks.

Two consequences worth knowing before coding:

- the existing `UNIQUE (message_id, storage_key)` already blocks duplicate keys
  within one message, so §4.1's duplicate-key rejection is a friendly-error
  concern, not an integrity one;
- `scan_status` defaults to `'clean'`, so a document row inserted without setting
  it explicitly is silently treated as scanned. Always set it from the verified
  scan result.

Optional hardening migration:

- check `media_type IN ('image', 'video', 'document')` — there is **no** such check
  today, only `NOT NULL`;
- require `file_name` for documents;
- index `(message_id, sort_order)` for the ordered page query;
- consider uniqueness on `storage_key` across messages if one upload must never
  attach to two messages. Note the current constraint is per-message, so today the
  same key *can* appear on two different messages.

Nothing here blocks the first release; the table works as-is.

Do not add attachment JSON to `circle_messages`; the relation already supports
ordered media and deletion safely.

Direct messages later require `direct_message_media` with the same attachment
columns and `(message_id, sort_order)` access pattern.

### 6.1 Legacy thread media cutover — verified unnecessary

**Checked against production (Supabase) on 18 Sep 2026: there is no media at
all.** `circle_post_media`, `circle_thread_media`, and `circle_message_media`
are all empty, against 8 threads and 12 messages. Migrations `048`/`049`/`050`
had nothing to copy.

So this whole subsection is a no-op for current data: no cutover migration, no
temporary `circle_thread_media` fallback in the API, no shared-key cleanup risk
from the `050` backfill, and no orphaned media behind threads whose
`root_message_id` is `NULL`. Drop these items from the release plan and keep the
rest of this subsection only as a guard in case media lands before the feature
ships — re-run the verification query below immediately before rollout.

Historical context, should the tables ever be non-empty: migrations `048` and
`049` copied old post attachments into `circle_thread_media`, and `050` copied
media to `circle_message_media` only for the then-linear `school_class` rows.
After `052`, wider groups also use a root `circle_message`, so their legacy
attachment rows could exist only at `circle_thread_media`.

Before enabling the new renderer, choose one canonical cutover:

1. **Recommended:** idempotently copy each legacy `circle_thread_media` row to
   its thread’s `root_message_id` in `circle_message_media`, preserving
   `storage_key`, type, metadata, scan status, and order.
2. Keep a temporary API fallback that reads `circle_thread_media` only when a
   root message has no `circle_message_media`.

Use the copy plus a temporary fallback during rollout, verify counts/key sets,
then remove the fallback. New uploads must never write `circle_thread_media`.
It remains compatibility data until a separate cleanup migration.

Verification query — must return zero rows before rollout (and, if a copy ever
becomes necessary, before its fallback is removed). Use this rather than
comparing row totals:

```sql
SELECT tm.thread_id, tm.storage_key
FROM circle_thread_media tm
JOIN circle_threads t ON t.id = tm.thread_id
LEFT JOIN circle_message_media mm
  ON mm.message_id = t.root_message_id
 AND mm.storage_key = tm.storage_key
WHERE t.root_message_id IS NOT NULL
  AND mm.id IS NULL;
```

Also count `circle_thread_media` rows whose thread has `root_message_id IS NULL`.
Those cannot be copied at all, and each one is media that no longer renders
anywhere. Decide before rollout whether to repair those threads or accept the
loss, and record the count either way.

---

## 7. Safety, moderation, and privacy

- Text moderation and attachment validation run independently.
- A moderated/deleted message returns no attachment URLs.

### 7.1 Message-level reporting — API and mobile only, no migration

A parent who receives an inappropriate photo must be able to report **that
message**. Today they cannot: `routes/chat.ts` exposes only
`POST /:threadId/report`, so the best a member can do is report an entire thread,
which is confusing to them and near-useless to a moderator trying to find one
image among fifty replies.

**The database is already ready.** Migration `047` added
`reports.target_circle_message_id` with a foreign key to `circle_messages(id)`,
and included it in the `reports_one_content_target` check constraint. No
migration is needed — only the route and the client were never built.

#### API

**One route, not two.** Every message-scoped action in this codebase is
circle-scoped and handles channel and thread messages in the same handler —
`/:circleId/messages/:messageId/reactions`, `/thread`, edit, and delete all follow
that shape, mounted by `createCircleChatRoutes` at `/v1/circles`. Reporting
follows it too:

```
POST /v1/circles/:circleId/messages/:messageId/report
```

`setMessageReaction` in `services/chat.ts` is the template to copy, because it
already solves the access problem correctly:

- select the message by `id` **and** `circle_id` with `status = 'visible'`, so
  deleted and moderated messages 404;
- if `thread_id` is set, authorize with `loadThreadAccess(...).canRead`; otherwise
  require `isCircleMember`;
- return **404, not 403**, for an inaccessible thread message, so message IDs
  cannot be probed;
- keep the `isBlocked` check.

Then insert `reporter_id`, `target_circle_message_id`, `target_user_id` (the
message author, matching the attribution pattern in `POST /:threadId/report`), and
a `parseReportReason` result. Populate exactly one content target so
`reports_one_content_target` holds — never both `target_thread_id` and
`target_circle_message_id`. Rate-limit per reporter and make a repeat report of
the same message by the same user idempotent rather than stacking rows.

Keep the existing `POST /v1/threads/:threadId/report`: reporting a whole
conversation is still valid, and the two are complementary.

#### Moderation view

Reporting a message implicitly reports its attachments, so the admin view needs
enough to act without opening the file: attachment count, media type, sanitized
filename, size, `scan_status`, and storage key. A moderator must be able to hide
the message and its attachments in one action — the existing moderation path
already hides attachments (§7), so this is a display concern, not new mechanics.

#### Mobile

`api.ts` already has `reportPost`, `reportConversation`, and `reportUser`; add
`reportChatMessage(token, circleId, messageId, reason)` in the same shape,
alongside the existing `reactToMessage` call it mirrors, and hang it off the
message action sheet next to Delete. Reuse the post report reason picker rather
than writing new copy.

This should ship **with** attachments, not after. Photos without a report path is
a moderation hole, and it is a small amount of work precisely because the schema
already anticipated it.

### 7.2 Other safety items

- Document filenames are visible to readers and can leak a child/parent name.
  Show a one-time composer note: `People in this conversation can see file
  names.`
- Strip directory paths and sanitize response filenames.
- Do not generate image/video previews from untrusted document content.
- Continue blocking macros and executable/archive formats.
- A guest granted one thread can download only attachments in that thread,
  never other media from the circle.

### 7.3 Deferred to a later release

**Explicitly out of scope for this release** (decision: 18 Sep 2026). These are
real risks, recorded so they are chosen rather than forgotten, but none blocks
shipping attachments. Revisit once the feature is live and volume is non-trivial.

**Location metadata / EXIF.** Nothing in this repo strips EXIF — not the API, not
`media-storage.ts`, not the client. For a pseudonymous app where parents
photograph children at school, a video carrying GPS coordinates can reveal a home
or school address to a whole group. `expo-image-picker` re-encodes images at
`quality: 0.85`, which usually drops EXIF, but it does **not** re-encode video, and
this has never been verified on a device. Note that posts already carry the same
exposure today, so attachments in chat do not make the app newly vulnerable —
which is what makes deferring defensible. When picked up: verify on real iOS and
Android hardware what survives for both images and video, then strip server-side
if video retains location.

**Upload abuse limits.** Message send is rate-limited, but
`POST /v1/media/upload-url` is a separate call any authenticated user can invoke,
including a thread-grant guest who is not a circle member. Wanted eventually: a
per-user hourly cap on upload URL creation, a daily byte budget, and a lower cap
for guests than members. Existing per-user message rate limits provide partial
cover in the meantime.

**Provider attachment policy.** The create payload accepts `asProvider`, so a
tutor or coaching centre could attach images and PDFs to thread replies — a
promotional-spam vector. Options when revisited: restrict provider replies to
text, apply a stricter cap, or route provider attachments through review.

**Media retention and per-circle byte budget.** Four 100 MB videos per message in
a wide group has no retention policy today.

---

## 8. Failure and edge cases

- **Picker cancelled:** return to unchanged draft.
- **App backgrounded mid-upload:** retain draft/local URI; retry when active.
- **Network loss after upload, before Send:** retain ready upload and retry
  message creation with the same `clientMessageId`.
- **Network loss after Send:** retry returns the existing hydrated message.
- **One of several uploads fails:** keep successful items; require explicit
  retry/remove for the failed item.
- **Document scan exceeds 60 seconds:** show Retry status check; do not upload
  another copy automatically.
- **Membership/grant revoked while composing:** Send returns access error;
  local files are not shown to recipients and abandoned-object cleanup handles
  uploaded keys.
- **Root deleted while replying:** reject the reply and keep its local draft.
- **Old client:** safely ignores the new response field.
- **Old messages:** render normally with an empty attachment list.

---

## 9. Implementation map

### Database

- harden `circle_message_media` constraints/indexes if missing;
- no destructive migration;
- add `direct_message_media` only in the later DM slice.

### API

Storage plumbing (§4.0) — six edits in `lib/media-storage.ts`:

- add `scope: "circle" | "chat"` to `createMediaUpload`, writing `chat-media/` and
  omitting `publicUrl` for chat;
- accept `chat-media/{userId}/` in `verifyUploadedMedia`;
- make `mediaPublicUrl` throw for `chat-media/` keys;
- add `chat-media/` to the `deleteStoredMedia` allow-list;
- rename `verifyCleanDocumentForPost` → `verifyCleanDocument`;
- leave `resolveDocumentScanStatus` and `createDocumentDownloadUrl` untouched.

Feature work:

- add the quantised-`signingDate` signed-URL helper (§4.6.1);
- create chat attachment validation/insertion/loading helpers;
- extend channel and thread create routes;
- extend channel/thread list and root reads with batched hydration;
- add a shared preview-text helper covering attachment-only messages;
- add the message report route (one route, no migration — see §7.1);
- add the authenticated chat attachment download route;
- add reference-aware storage cleanup outbox handling;
- update account deletion to collect `circle_message_media` keys;
- include attachment-aware notification previews.

### Mobile

- extract picker/upload state from the post composer;
- add `+` attachment sheet and selected tray to `ChatThreadScreen`;
- extend `ChatMessage` and send methods;
- render media grids and document rows inside `Bubble`;
- build the `Modal` + paged `FlatList` gallery (chat only, not shared with posts);
- render Phase 1 video tiles (play badge plus `asset.duration`) and hand off
  playback to `Linking`;
- add `reportChatMessage` to the message action sheet;
- preserve drafts and retry state;
- add accessibility labels and announcements;
- change the iOS photo-library permission text from “circle posts” to
  “messages and posts.”

The Phase 1 scope in §2.5 needs no new native dependency: the app already ships
`expo-image-picker`, `expo-document-picker`, `expo-file-system`, and
`expo-sharing`, and the gallery can be built from `Modal` plus `FlatList`. So
picking, uploading, sending, grids, document rows, and the `Linking` handoff are
all OTA-deliverable to binaries on runtime version 1.0.3 — confirm the
production binary before committing to OTA-only.

What is **not** OTA-deliverable, because nothing in `package.json` provides it:

- video poster frames (`expo-video-thumbnails`);
- in-app video playback and mute/silent handling (`expo-video` or `expo-av`);
- efficient cached remote images with header control (`expo-image`).

These are Phase 2 (§2.5). Bundle all three into one store build.

---

## 10. Release order

1. Confirm media storage, document scanning, and production binary modules.
   **Verify the CloudFront deny for paths outside `circle-media/*` and
   `listing-media/*` is actually deployed** — `chat-media/` privacy depends
   entirely on it (§4.0).
2. Apply optional DB hardening. No legacy thread-media copy is needed (§6.1);
   re-run its verification query first to confirm the tables are still empty.
3. Land the six `media-storage.ts` prefix edits plus their two regression tests
   (§4.0). Harmless on their own — no caller passes `scope: "chat"` yet.
4. Deploy API read support (`attachments: []` for current data) together with the
   preview-text helper (§4.4.1), so attachment-only messages can never render a
   blank row.
5. Deploy API create, signed-URL, download, cleanup, and message report support.
6. Ship the mobile composer, renderer, Phase 1 video tiles, gallery, and report
   action to preview.
7. Test channel messages, thread replies, guest threads, revocation, block,
   moderation, deletion, reporting, and retries.
8. Publish production OTA if runtime/native compatibility is confirmed;
   otherwise publish a new store build.
9. Observe upload failures, scan latency, orphan cleanup, API latency, S3 egress,
   and attachment-related reports.
10. Plan the Phase 2 store build (`expo-video`, `expo-video-thumbnails`,
    `expo-image`) once Phase 1 is stable.

---

## 11. Acceptance checklist

### Compose and send

- [ ] Send 2–4 photos as one channel message.
- [ ] Send mixed photos and one video as one message.
- [ ] Send PDF, Word, and Excel files.
- [ ] Send an attachment without text.
- [ ] Add attachments to a thread reply.
- [ ] Remove selected items before Send; retained items keep selection order.
- [ ] Failed item supports Retry and Remove without losing text.
- [ ] Double-tap/retry never creates duplicate messages or attachment rows.

### Display

- [ ] One/two/three/four-image layouts are correct on narrow Android screens.
- [ ] Video never autoplays and opens successfully.
- [ ] Document shows sanitized full filename to accessibility services.
- [ ] Attachment-only quote/reply preview has a meaningful label.
- [ ] Root attachment remains visible when opening its thread.
- [ ] Deleted/moderated message exposes no attachment content.

### Access and safety

- [ ] Non-member cannot resolve a channel attachment.
- [ ] Revoked guest cannot resolve an old thread attachment.
- [ ] Blocked users’ messages and attachments follow current block behavior.
- [ ] Leaked signed URL expires quickly.
- [ ] Renamed executable, macros, oversized files, and fourth document fail.
- [ ] Account deletion removes or schedules every chat object.

### Reliability

- [ ] Background/foreground during upload preserves draft.
- [ ] Offline send can retry without repicking.
- [ ] Timeout after server commit resolves through idempotent retry.
- [ ] Realtime receiver gets attachment metadata through catch-up.
- [ ] Pagination does not introduce N+1 attachment queries.

### Previews and moderation

- [ ] Attachment-only message shows a meaningful inbox preview, Home snippet,
      last-reply line, and push body — never a blank row.
- [ ] A message with an inappropriate photo can be reported directly.
- [ ] Admin audit view shows attachment metadata for a reported message.
- [ ] A chat storage key passed to `deleteStoredMedia` is actually deleted, not
      skipped by the prefix allowlist.

### Storage and URLs

- [ ] A chat upload lands under `chat-media/{userId}/`, and the response contains
      no `publicUrl`.
- [ ] `mediaPublicUrl` throws for a `chat-media/` key.
- [ ] Fetching a `chat-media/` object through the CDN domain returns 403.
- [ ] Two list requests within the same hour return byte-identical media URLs, so
      images are served from the client cache rather than re-downloaded.
- [ ] A media URL still resolves at least an hour after it was issued.
- [ ] A document download URL expires within ~60 seconds.
- [ ] A chat document still promotes to `post-docs/` and downloads through the
      chat access check.
- [ ] A video tile shows the correct `m:ss` duration and opens playable.

---

## 12. Decision log

All six items that previously blocked implementation are now settled. Nothing in
this spec is waiting on a decision.

| # | Item | Resolution |
|---|---|---|
| 1 | Storage prefixes (§4.0) | **Decided.** New `chat-media/` for photos/video, because `circle-media/*` is public via CloudFront. Documents keep `quarantine/` → `post-docs/`. Six call sites listed. |
| 2 | Signed URLs and TTL (§4.6.1) | **Decided.** S3 presigned GET with a quantised `signingDate`; 1-hour signature window, 2-hour validity for media, 60 s for documents. No CloudFront signing infra needed. |
| 3 | Video scope (§2.5) | **Planned in two phases.** Phase 1 (play badge + real duration + OS handoff + `Modal`/`FlatList` gallery) is OTA-safe. Poster frames, inline playback, and `expo-image` are bundled into one later store build. |
| 4 | Message reporting (§7.1) | **Decided: ships with attachments.** Cheaper than thought — `reports.target_circle_message_id` already exists from migration `047`, so it is route + mobile only. |
| 5 | EXIF/GPS (§7.3) | **Deferred.** Posts carry the same exposure today, so chat attachments do not introduce a new class of leak. |
| 6 | Provider attachments, upload rate limits, retention (§7.3) | **Deferred.** Existing message rate limits give partial cover. |

Still genuinely undecided, but not blocking: whether message editing may ever add,
remove, or reorder attachments (§2.7 keeps them immutable for v1).

### Verified against the running system

Recorded so the next reader does not re-derive them:

- production has **zero rows** in `circle_post_media`, `circle_thread_media`, and
  `circle_message_media` (18 Sep 2026) — no legacy migration needed (§6.1);
- `reports.target_circle_message_id` already exists (migration `047`);
- `circle_message_media` already has every column v1 needs — including
  `duration_ms` — except a video poster key, which only Phase 2 requires;
- `circle_messages.body` is nullable, so attachment-only messages need no schema
  change;
- create routes are `POST /v1/circles/:circleId/messages` (via
  `createCircleChatRoutes`) and `POST /v1/threads/:threadId/messages`;
- message-scoped actions are all circle-scoped and branch on `thread_id` inside one
  handler; `setMessageReaction` is the access-control template for the report route;
- limits are real constants: `MAX_POST_MEDIA = 4`, `MAX_POST_DOCUMENTS = 3`, image
  10 MB, video 100 MB, PDF 20 MB, Office 10 MB;
- `expo-image-picker` already returns `asset.duration`, so duration badges need no
  new dependency;
- `circle-media/*` and `listing-media/*` are the only CDN-public prefixes, and the
  CloudFront deny for everything else is a **pending manual ops step** — confirm it
  is deployed before release.

