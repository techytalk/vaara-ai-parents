# Document attachments on posts (PDF, Word, Excel)

**Status: implemented in code.** Remaining ops: run migrations `034`/`035`, wire GuardDuty + EventBridge + IAM/CloudFront path deny in AWS, set `GUARDDUTY_*` env vars, then ship a **new native build** (expo-document-picker / expo-sharing). See §10–12.

Related: photos and videos already work end to end — presigned PUT to S3, `verifyUploadedMedia`, rows in `circle_post_media`, reads through CloudFront ([S3 and CDN setup](./S3_MEDIA_SETUP.md)). Documents reuse that spine but **do not** reuse the public CDN path. Edit rules follow [Edit own circle posts](./POST_EDIT.md).

Ground rules from [Feature Implementation Plan](./FEATURE_IMPLEMENTATION_PLAN.md) still apply: reuse `circle_post_media`, membership checks via `assertCircleMember`, never denormalise author labels.

---

## 1. Why

Class and school circles are where circulars, syllabi, fee structures, holiday lists, and homework sheets get shared. Today a parent has to screenshot a PDF and post it as an image, which is unreadable on a phone and loses the ability to search or forward it.

Documents are **not** a general file-hosting feature. No ZIPs, no executables, no media libraries, no versioning.

---

## 2. Scope

### v1 (build this)

| In | Out |
|----|-----|
| PDF, `.docx`, `.xlsx` | ZIP, RAR, `.exe`, `.apk`, audio, `.txt`, `.csv` |
| Any post, any circle type, member or guest | Per-school or per-circle-type gating |
| Up to 3 documents per post | Folders, multi-file bundles |
| Malware scan + format validation before the file is readable | Virus quarantine review UI for admins |
| Attach on create **and** edit | In-app PDF viewer (hand off to the OS instead) |
| Open via the system share sheet | Preview thumbnails of page 1 |

Macro-enabled Office formats (`.docm`, `.xlsm`, `.xlsb`) are **rejected outright**, and a `.docx`/`.xlsx` containing `vbaProject.bin` is rejected too. Office macros are the most common malware vector in circulars.

### Later (do not build in v1)

- Inline PDF preview / thumbnails
- Documents on marketplace listings (listings stay images-only)
- Admin review queue for blocked files
- Re-scan on signature updates

---

## 3. Product rules

1. **No circle gating.** Any post in any circle can carry documents. A cross-post is one post in many circles, so the attachment travels with it automatically (`circle_post_targets`).
2. **Limits.** PDF ≤ 20 MB. `.docx` / `.xlsx` ≤ 10 MB. Max 3 documents per post, independent of the existing `MAX_POST_MEDIA` (4) photos/videos.
3. **A document alone is a valid post.** Same rule as media today: body, poll, **or** attachment satisfies "post must have content".
4. **Nothing is readable until it is clean.** A file that has not passed scanning has no route any client can resolve. See §6.
5. **Blocked files are destroyed, not stored.** On a bad verdict the S3 object is deleted and no row is written. The parent sees why.
6. **Documents are never public.** Unlike images, documents are not served from CloudFront. Downloads go through an authenticated API endpoint that issues a short-lived presigned GET (§7.3).
7. **Author only, same as edit.** Adding or removing a document on an existing post follows the `POST_EDIT.md` ownership rules. Audience stays frozen.
8. **Privacy unchanged.** The stored `file_name` is shown as-is, so the composer warns that filenames are visible to the circle. Nothing else about the file is surfaced.

---

## 4. Parent flow and UI

### 4.1 Composer

Toolbar gains a paperclip as a fourth action beside image, poll, and interests.

```
┌──────────────────────────────────────────────┐
│ ←  New post                                  │
├──────────────────────────────────────────────┤
│ (👥 Bowrampet · Hy… ▾)  (💬 General ▾)       │
│ (🚫 Anonymous)                               │
│                                              │
│ Term 1 syllabus is out — attaching the PDF.  │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 📕  Term1_Syllabus.pdf                 ✕ │ │
│ │     1.4 MB · Checking file…              │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ 📗  Fee_structure.xlsx                 ✕ │ │
│ │     212 KB · Ready                       │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│  🖼    📊    📎    🏷                     45 │
│ ┌──────────────────────────────────────────┐ │
│ │                  Post                    │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Upload starts the moment the file is picked, not when Post is tapped.** The parent keeps typing while the scan runs, so by the time they hit Post the verdict is in and publishing is instant.

Row states:

| State | Subtitle | Post button |
|-------|----------|-------------|
| `uploading` | `1.4 MB · Uploading…` | disabled |
| `scanning` | `1.4 MB · Checking file…` | disabled |
| `clean` | `PDF · 1.4 MB · Ready` | enabled |
| `blocked` | `Blocked — this file failed the safety check` | enabled (file excluded) |
| `failed` | `Could not check this file. Remove it and try again.` | enabled (file excluded) |

A rejected file replaces its own row rather than firing an `Alert`, so the parent never loses typed text:

```
│ ┌──────────────────────────────────────────┐ │
│ │ ⚠️  scholarship_form.pdf               ✕ │ │
│ │     Blocked — this file failed the safety │ │
│ │     check and was not uploaded            │ │
│ └──────────────────────────────────────────┘ │
```

### 4.2 On the post

Documents render **after** the media gallery and **before** the circle/interest chips, so a card reads content → attachments → context → actions.

```
│  ⌗ General                                     │
│  Term 1 syllabus is out.                       │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 📕  Term1_Syllabus.pdf                   │  │
│  │     PDF · 1.4 MB              [ Open ]   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  (👥 CBSE · Grade 5)  (🏷 Homework)            │
│                                                │
│  👍 Helpful                     💬   ↗   🔖    │
└────────────────────────────────────────────────┘
```

Icons by type: 📕 PDF, 📘 `.docx`, 📗 `.xlsx`.

**Open** downloads through the presigned URL with `FileSystem.downloadAsync`, then hands the local file to `expo-sharing`, which opens the OS share sheet so the file lands in whatever PDF or Sheets app the parent already uses. `apps/mobile/src/lib/share-post.ts` already does this download step for share images — follow it.

### 4.3 Permissions

`expo-document-picker` uses the system document provider, **not** the photo library. No runtime permission on either platform: no Android `READ_MEDIA_*` equivalent, no iOS usage-description string. Nothing to add to `app.json` beyond the plugin itself.

---

## 5. Data model

Only `circle_post_media` changes. No new tables — see §6.4 for why there is deliberately no staging table.

### 5.1 Migration `034_post_media_document_enum.sql`

The runner wraps every migration file in `BEGIN`/`COMMIT` (`packages/db/src/migrate.ts`), and a new enum value cannot be *used* in the transaction that adds it. `007_enum_additions.sql` set the precedent: enum additions get their own file with no table changes.

```sql
-- Enum addition only. No inserts or table changes in this migration:
-- a new enum value cannot be used in the transaction that adds it.

ALTER TYPE post_media_type ADD VALUE IF NOT EXISTS 'document';
```

### 5.2 Migration `035_post_document_media.sql`

```sql
-- Documents (PDF / docx / xlsx) reuse circle_post_media. Existing image and
-- video rows are already scanned-and-served, so they default to 'clean'.

ALTER TABLE circle_post_media
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz;

ALTER TABLE circle_post_media
  DROP CONSTRAINT IF EXISTS circle_post_media_scan_status_check;

ALTER TABLE circle_post_media
  ADD CONSTRAINT circle_post_media_scan_status_check
  CHECK (scan_status IN ('pending', 'clean', 'blocked', 'failed'));

-- A document must carry the original name; images and videos never did.
ALTER TABLE circle_post_media
  ADD CONSTRAINT circle_post_media_document_needs_name
  CHECK (media_type <> 'document' OR file_name IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_circle_post_media_scan_status
  ON circle_post_media(scan_status)
  WHERE scan_status <> 'clean';
```

Register both in `packages/db/src/migrate.ts`:

```ts
  { version: "034_post_media_document_enum", file: "034_post_media_document_enum.sql" },
  { version: "035_post_document_media", file: "035_post_document_media.sql" },
```

### 5.3 Column meaning

| Column | Documents | Images / videos |
|--------|-----------|-----------------|
| `media_type` | `'document'` | unchanged |
| `mime_type` | `application/pdf`, `…wordprocessingml.document`, `…spreadsheetml.sheet` | unchanged |
| `file_name` | original name, shown in the UI | `NULL` |
| `size_bytes` | real size from `HeadObject` | unchanged |
| `width` / `height` / `duration_ms` | `NULL` | unchanged |
| `scan_status` | always `'clean'` when written | `'clean'` by default |

`scan_status` on the row is defence in depth. A row is only ever inserted after a clean verdict, but read paths still filter `scan_status = 'clean'` so a future async mode cannot leak a pending file.

---

## 6. Storage and scanning

### 6.1 Bucket layout

Bucket `vaara-parents-connect` (`ap-south-1`), Block Public Access on, CloudFront OAC in front.

| Prefix | Contents | Reachable by |
|--------|----------|--------------|
| `circle-media/{userId}/` | images, videos | public CloudFront URL (today) |
| `listing-media/{userId}/` | listing images | public CloudFront URL (today) |
| `quarantine/{userId}/` | **new** — freshly uploaded documents | nobody |
| `post-docs/{userId}/` | **new** — clean documents | presigned GET via API only |

Add a **CloudFront behaviour that 403s any path outside `circle-media/*` and `listing-media/*`**. Without this, `post-docs/` would be publicly fetchable the moment someone guessed a key, defeating the membership check.

Add an **S3 lifecycle rule expiring `quarantine/` objects after 1 day** so abandoned uploads clean themselves up.

### 6.2 The flow

```
phone ──presigned PUT──> quarantine/{userId}/{uuid}.pdf
                              │  no CDN route, no DB row, unreachable
                              ▼
                    GuardDuty scans on arrival
                              │
                              ▼
              EventBridge ──> POST /v1/media/documents/scan-callback
                              │
          NO_THREATS_FOUND ───┴─── THREATS_FOUND / UNSUPPORTED / FAILED
                    │                        │
                    ▼                        ▼
    copy to post-docs/, delete       delete object,
    quarantine copy, status clean    status blocked, never referenced
```

Composer polls `GET /v1/media/documents/status?storageKey=…` every 2s (cap ~60s, then `failed`).

### 6.3 GuardDuty Malware Protection for S3

Chosen over a self-hosted ClamAV worker: nothing to run, nothing to patch, no signature database to keep fresh, and you are already on real AWS.

Setup:

1. GuardDuty console → **Malware Protection for S3** → **Enable** → select bucket `vaara-parents-connect`.
2. Scope to prefix `quarantine/` so you are not paying to scan every photo.
3. Enable **tag objects with the scan result** — GuardDuty writes `GuardDutyMalwareScanStatus` onto the object.
4. Let the console create the IAM service role it asks for.
5. EventBridge rule: source `aws.guardduty`, the Malware Protection object-scan-result detail type → **API destination** pointing at `POST https://api.vaara.ai/v1/media/documents/scan-callback`, with a static secret header.

> Confirm the exact detail-type string and the per-GB price in the console when wiring the rule — treat the value above as the shape, not gospel.

Verdicts map as: `NO_THREATS_FOUND` → promote; `THREATS_FOUND` → delete + `blocked`; `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED` → delete + `failed`.

The callback endpoint must verify the shared secret, be idempotent (EventBridge retries), and ignore keys outside `quarantine/`.

### 6.4 Why there is no staging table

A document is uploaded before the post exists, so it has no `post_id` yet. The obvious move is a `media_uploads` staging table — but everything that table would hold already lives elsewhere: ownership is provable from the key prefix (`quarantine/{userId}/`, the same trick `verifyUploadedMedia` uses today), size and MIME come from `HeadObject`, and the scan verdict is an S3 object tag written by GuardDuty. Adding a table would mean a second source of truth plus a reaper job for abandoned rows.

Trade-off: a document uploaded and never posted leaves an object in `post-docs/`. Images have this exact orphan behaviour today, and the lifecycle rule handles the `quarantine/` half. Orphan sweeping for both is a later chore, not a v1 blocker.

---

## 7. Security pipeline

Antivirus alone is not enough — it catches known malware, not a renamed `.exe` or a macro-laden spreadsheet. Seven layers, cheapest first, each independently sufficient to reject.

| # | Layer | Where | Catches |
|---|-------|-------|---------|
| 1 | Extension + size + count | mobile, before upload | honest mistakes, wasted bandwidth |
| 2 | MIME allowlist, extension↔MIME agreement, size cap, per-user rate limit | `POST /v1/media/upload-url` | wrong types, oversized files, abuse |
| 3 | `HeadObject` — real `ContentLength` and `ContentType` | verify endpoint | client lying about size or type |
| 4 | **Magic bytes** — ranged GET of first 8 KB | verify endpoint | renamed executables |
| 5 | **Macro block** | verify endpoint | the main Office attack vector |
| 6 | GuardDuty scan | AWS, async | known malware |
| 7 | `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` | download endpoint | browser rendering a file inline |

### 7.1 Magic bytes (layer 4)

One cheap `GetObjectCommand` with `Range: bytes=0-8191`, then:

| Claimed type | Must satisfy |
|---|---|
| `application/pdf` | starts with `%PDF-` |
| `.docx` / `.xlsx` | starts with `PK\x03\x04` **and** the zip central directory contains `[Content_Types].xml` |

Anything else is rejected regardless of the declared MIME type. This is the check that stops a renamed binary, and it runs before GuardDuty so obvious junk never costs a scan.

### 7.2 Macro block (layer 5)

Reject `.docm`, `.xlsm`, `.xlsb` at layer 2 by extension and MIME. For `.docx`/`.xlsx`, parse the zip central directory from the ranged read and reject if any entry is named `vbaProject.bin`.

### 7.3 Download endpoint (layer 7)

`GET /v1/media/:mediaId/download`

1. Load the `circle_post_media` row; 404 unless `media_type = 'document'` and `scan_status = 'clean'`.
2. Resolve the post's circles via `circle_post_targets` and assert the caller can read at least one, reusing the same access logic as `GET /v1/circles/:circleId/posts/:postId`.
3. Return a presigned GET valid for **60 seconds** with `ResponseContentDisposition: attachment; filename="…"` and `ResponseContentType` set from the stored MIME.

Never return a permanent URL. A leaked link expires in a minute instead of exposing a class circular forever.

### 7.4 IAM

`vaara-api-media` currently allows `s3:PutObject` and `s3:GetObject` on the two media prefixes only. Extend it:

```json
{
  "Sid": "VaaraDocumentObjects",
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:GetObjectTagging",
    "s3:DeleteObject"
  ],
  "Resource": [
    "arn:aws:s3:::vaara-parents-connect/quarantine/*",
    "arn:aws:s3:::vaara-parents-connect/post-docs/*"
  ]
}
```

`s3:GetObjectTagging` reads the GuardDuty verdict; `s3:DeleteObject` destroys blocked files and cleans up after promotion. The copy step needs `s3:PutObject` on `post-docs/*` plus `s3:GetObject` on `quarantine/*`, both covered above.

---

## 8. API

### 8.1 `POST /v1/media/upload-url` (extend)

`apps/api/src/routes/media.ts` currently 400s anything that is not `image` or `video`. Add `document`:

```ts
mediaType: "image" | "video" | "document"
purpose?: "post" | "listing"
```

- `document` + `purpose: "listing"` → 400, listings stay images-only.
- Documents get `quarantine/{userId}/{uuid}.{ext}`, not `circle-media/…`.
- `validateMediaRequest` gains a document branch: MIME must be one of the three, size against `MAX_DOCUMENT_BYTES` (20 MB PDF, 10 MB Office), extension must match the MIME.

Response is unchanged except `publicUrl` is omitted for documents — they have no public URL.

### 8.2 `POST /v1/media/documents/verify` (new)

Body `{ storageKey, fileName, mimeType }`. Runs layers 3–5 synchronously and returns `{ status: "scanning" }` on pass, or 400 with a reason on fail (deleting the object first).

### 8.3 `GET /v1/media/documents/status` (new)

Query `?storageKey=…`. Reads the object tag. On `NO_THREATS_FOUND` and not yet promoted, performs the copy-and-delete, then returns:

```json
{ "status": "clean", "storageKey": "post-docs/…", "fileName": "…", "sizeBytes": 1468006 }
```

Otherwise `{ "status": "scanning" | "blocked" | "failed", "reason": "…" }`.

### 8.4 `POST /v1/media/documents/scan-callback` (new)

EventBridge target. Shared-secret header, idempotent, ignores non-`quarantine/` keys. Does the same promote/destroy work as §8.3 so a client that stopped polling still gets a resolved file.

### 8.5 Post create and edit

`POST /v1/circles/:circleId/posts` and `PATCH …/:postId` accept a `documents` array alongside `media`:

```ts
documents?: Array<{ id?: string; storageKey?: string; fileName?: string; mimeType?: string }>
```

- Same shape convention as `media`: `{ id }` keeps an existing row, `{ storageKey }` attaches a new one.
- Server re-verifies each new `storageKey` starts with `post-docs/{userId}/` and that the object exists — never trust the client's word that scanning passed.
- Rows insert with `media_type = 'document'`, `scan_status = 'clean'`, `scanned_at = now()`.
- Cap of 3 enforced server-side.
- `applyMediaReplace` in `apps/api/src/lib/post-update.ts` handles the keep/drop/reorder diff for edit; extend it rather than writing a parallel path, and route dropped document keys into the existing `deleteStoredMedia` cleanup.

### 8.6 Read paths

`loadPostMedia` exists twice — `apps/api/src/routes/circles.ts` and `apps/api/src/services/feed.ts`. Both must:

- select `file_name`, `media_type`, `scan_status`
- filter `scan_status = 'clean'`
- split the result into `media` (image/video, with `url` from `mediaPublicUrl`) and `documents` (id, fileName, mimeType, sizeBytes — **no url**)

`mapPost` in both files gains a `documents` array, the same way `topics` and `circles` were added.

---

## 9. Mobile

New dependencies: `expo-document-picker`, `expo-sharing`. Both are native modules, so **this ships as a new APK/IPA, not an OTA.**

| File | Change |
|------|--------|
| `apps/mobile/src/lib/api.ts` | `documents` on `CirclePost`; `createDocumentUpload`, `verifyDocument`, `documentStatus`, `documentDownloadUrl` |
| `apps/mobile/src/lib/media-local.ts` | reuse `resolveMediaBytes` / `uploadMediaBytes` — the `fetch`-based path already handles `content://` and works for documents unchanged |
| `apps/mobile/src/components/circles/PostDocumentList.tsx` | **new** — the attachment rows, shared by feed card, circle card, and thread |
| `apps/mobile/app/circles/[circleId]/new-post.tsx` | paperclip action, picker, per-file state machine, polling, `documents` in create/edit payloads |
| `apps/mobile/src/components/feed/FeedPostCard.tsx` | render `PostDocumentList` between media and `PostContextChips` |
| `apps/mobile/app/circles/[circleId]/index.tsx` | same, in the circle-feed `PostCard` |
| `apps/mobile/app/circles/[circleId]/posts/[postId].tsx` | same, in the thread header |
| `apps/mobile/app.json` | add the `expo-document-picker` plugin, bump `versionCode` |

Picker call:

```ts
DocumentPicker.getDocumentAsync({
  type: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  multiple: true,
  copyToCacheDirectory: true,
});
```

---

## 10. Build order

1. Migrations `034` + `035`, registered in `migrate.ts`, run against a Neon branch first.
2. AWS: quarantine + post-docs prefixes, CloudFront path restriction, lifecycle rule, IAM policy, GuardDuty enable, EventBridge rule.
3. API: `media-storage.ts` document support, then the four endpoints in §8.
4. API: post create/edit/read threading.
5. Mobile: deps, `PostDocumentList`, composer, renderers.
6. New APK, verify on device.

Steps 1–4 are deployable on their own and change nothing for existing users — no client sends `documents` yet.

---

## 11. Environment

| Variable | Purpose |
|----------|---------|
| `GUARDDUTY_CALLBACK_SECRET` | shared secret the EventBridge destination sends and the callback verifies |

No other new variables. `S3_BUCKET`, `AWS_REGION`, and credentials are already set; `CDN_BASE_URL` is untouched because documents never use it.

---

## 12. Test checklist

**Format and safety**

- [ ] Clean PDF, `.docx`, `.xlsx` each attach and open
- [ ] `.exe` renamed to `.pdf` → rejected at magic bytes, object deleted
- [ ] `.docm` → rejected at layer 2
- [ ] `.docx` containing `vbaProject.bin` → rejected at layer 5
- [ ] EICAR test file → `THREATS_FOUND`, deleted, row never written
- [ ] 25 MB PDF → rejected at presign, no upload
- [ ] 4th document → rejected server-side even if the client allows it

**Access**

- [ ] Non-member cannot download via `/v1/media/:mediaId/download`
- [ ] Guessing a `post-docs/` CloudFront URL returns 403
- [ ] A presigned download URL is dead after 60 seconds
- [ ] Downloaded file arrives as an attachment, not rendered inline

**Behaviour**

- [ ] Post with only a document and no text succeeds
- [ ] Cross-posted document is readable from every target circle
- [ ] Removing a document on edit deletes the S3 object
- [ ] Abandoning the composer mid-scan leaves nothing user-visible
- [ ] Old app build ignores `documents` without crashing

---

## 13. Risks

- **GuardDuty latency.** Scans are seconds, not instant. Upload-on-pick hides it, but a parent who picks a file and taps Post immediately will wait. The 60-second poll cap plus the `failed` state keeps that bounded.
- **Region and pricing.** Confirm Malware Protection for S3 in `ap-south-1` and its per-GB rate before enabling.
- **Filenames leak context.** `Ravi_Sharma_feeslip.pdf` in an anonymous post defeats the anonymity. The composer must warn that the filename is visible; consider offering a rename field in v2.
- **Orphaned `post-docs/` objects** from abandoned composers, as discussed in §6.4.
