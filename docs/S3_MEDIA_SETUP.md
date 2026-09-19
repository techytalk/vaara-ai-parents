# S3 and CDN setup (Vaara Parents)

Post, marketplace, and chat photos/videos upload **directly from the phone to
S3** via a presigned URL. The API verifies each object, then stores the
`storage_key` in Postgres.

- Post and marketplace reads use public CloudFront URLs.
- Chat media stays private under `chat-media/`. After checking chat access, the
  API returns a short-lived presigned S3 GET URL.
- Documents stay private under `post-docs/` after quarantine and scanning.

## Your bucket

| Setting | Value |
|---------|--------|
| **Bucket** | `vaara-parents-connect` |
| **Region** | `ap-south-1` (Mumbai) |
| **Object prefixes** | `circle-media/{userId}/…` (public post media), `listing-media/{userId}/…` (public marketplace media), `chat-media/{userId}/…` (private chat media), `quarantine/{userId}/…` (documents pending scan), `post-docs/{userId}/…` (clean private documents) |
| **Recommended CDN domain** | `https://media.vaara.ai` (or CloudFront default URL until DNS is ready) |

---

## 1. S3 bucket (already created)

In [S3 console](https://s3.console.aws.amazon.com/s3/buckets/vaara-parents-connect):

1. **Block Public Access** — keep **all four** ON (bucket stays private).
2. **Default encryption** — enable SSE-S3 (AES-256).
3. **CORS** — optional for native Android/iOS; required only for web uploads:

```json
[
  {
    "AllowedHeaders": ["content-type"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use `AllowedOrigins: ["https://vaara.ai"]` instead of `*` if you add a web uploader later.

---

## 2. IAM user for the API

Create an IAM user (for example, `vaara-api-media`) with **programmatic access**
and attach the policy below. Replace the bucket name if it changes.

`s3:PutObject` is required when the API signs an upload. `s3:GetObject` covers
both `HeadObject` verification and signed downloads. `s3:DeleteObject` is
required by message/post deletion and account cleanup; the S3 `DeleteObjects`
API uses this same IAM action.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VaaraPublicMediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::vaara-parents-connect/circle-media/*",
        "arn:aws:s3:::vaara-parents-connect/listing-media/*"
      ]
    },
    {
      "Sid": "VaaraPrivateChatMediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::vaara-parents-connect/chat-media/*"
      ]
    },
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
  ]
}
```

### Apply the IAM fix to the existing production user

1. In Vercel, open the API project and note the last four characters of the
   production `AWS_ACCESS_KEY_ID`. Do not copy the secret anywhere.
2. In AWS IAM, open **Users**, select the media user, then
   **Security credentials**. Confirm its access key matches the key used by
   Vercel.
3. Open **Permissions → Add permissions → Create inline policy → JSON**.
4. Paste the complete policy above, review it, and save it as
   `VaaraMediaObjectAccess`. If an older inline policy already grants these
   prefixes, update that policy instead of attaching a duplicate.
5. Confirm that `chat-media/*` has `PutObject`, `GetObject`, and `DeleteObject`.
6. Policy changes apply to the existing access key. No key rotation or Vercel
   redeploy is required solely for this IAM edit.

Do not grant `s3:*`, bucket-wide object access, `PutObjectAcl`, or public ACL
permissions. The API only needs the object operations and prefixes above.

### Keep private prefixes out of CloudFront

The API IAM policy and the CloudFront OAC bucket policy are separate:

- The API IAM user must access all five prefixes.
- CloudFront OAC must read only `circle-media/*` and `listing-media/*`.
- CloudFront must not read `chat-media/*`, `quarantine/*`, or `post-docs/*`.

In the S3 bucket policy statement created for CloudFront OAC, restrict
`Resource` to these two ARNs rather than the whole bucket:

```json
"Resource": [
  "arn:aws:s3:::vaara-parents-connect/circle-media/*",
  "arn:aws:s3:::vaara-parents-connect/listing-media/*"
]
```

Keep the generated `AWS:SourceArn` condition that identifies your CloudFront
distribution. If the OAC statement currently uses
`arn:aws:s3:::vaara-parents-connect/*`, narrow it before releasing chat media.

Also:

1. **CloudFront** — only `circle-media/*` and `listing-media/*` may resolve.
   Requests for every private prefix must return **403**.
2. **S3 lifecycle** — expire `quarantine/` objects after **1 day**.
3. **GuardDuty Malware Protection for S3** — scope to `quarantine/`, tag scan results, EventBridge → `POST /v1/media/documents/scan-callback` with `x-vaara-scan-secret` (`GUARDDUTY_CALLBACK_SECRET`). Set `GUARDDUTY_MALWARE_PROTECTION_ENABLED=true` on the API when live (without it, verify promotes after magic-byte checks for local/dev).

Full product/API detail: [POST_DOCUMENT_ATTACHMENTS.md](./POST_DOCUMENT_ATTACHMENTS.md).

Save the **Access key ID** and **Secret access key** — you add them to Vercel once.

---

## 3. CloudFront (CDN) — required for uploads to work in the app

The API treats media as configured only when `S3_BUCKET`, AWS credentials, **and**
`CDN_BASE_URL` are all set (`apps/api/src/lib/media-storage.ts`).

### Create distribution

1. [CloudFront](https://console.aws.amazon.com/cloudfront/) → **Create distribution**
2. **Origin domain** — select `vaara-parents-connect.s3.ap-south-1.amazonaws.com`
3. **Origin access** — **Origin access control (OAC)** → create new OAC
4. When prompted, **copy the bucket policy** AWS generates and paste it on the S3 bucket
   (**Permissions → Bucket policy**).
5. **Viewer protocol policy** — Redirect HTTP to HTTPS
6. **Allowed HTTP methods** — GET, HEAD (reads only; uploads use presigned PUT to S3)
7. **Price class** — Use only North America and Europe, or all edge locations

After deploy, note the distribution domain, e.g. `https://d111111abcdef8.cloudfront.net`.

### Custom domain (optional, recommended)

1. CloudFront → **Alternate domain name (CNAME)** → `media.vaara.ai`
2. Request or attach an ACM certificate (must be in **us-east-1** for CloudFront)
3. DNS: CNAME `media.vaara.ai` → `d111111abcdef8.cloudfront.net`

Set `CDN_BASE_URL` to `https://media.vaara.ai` (no trailing slash).

---

## 4. Environment variables

### Vercel (`api.vaara.ai`)

Project → **Settings → Environment Variables** → **Production** (and Preview if needed):

| Variable | Value |
|----------|--------|
| `AWS_REGION` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | from IAM user |
| `AWS_SECRET_ACCESS_KEY` | from IAM user |
| `S3_BUCKET` | `vaara-parents-connect` |
| `CDN_BASE_URL` | `https://dxxxx.cloudfront.net` or `https://media.vaara.ai` |
| `GUARDDUTY_CALLBACK_SECRET` | shared secret for EventBridge → `/v1/media/documents/scan-callback` |
| `GUARDDUTY_MALWARE_PROTECTION_ENABLED` | `true` in production once GuardDuty is wired (omit/false promotes docs after format checks) |

Redeploy the API after saving.

### Local (`.env.local`)

Same five variables for `npm run dev:api`.

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=vaara-parents-connect
CDN_BASE_URL=https://media.vaara.ai
```

Do **not** commit access keys to git.

---

## 5. Verify

```bash
# After Vercel redeploy — no auth required for status shape, but route needs JWT in app
curl -s https://api.vaara.ai/v1/media/status -H "Authorization: Bearer YOUR_JWT"
# {"configured":true}
```

In the mobile app: **New post** → **Add photos or videos** should be enabled (not
“S3 and CDN configuration required”).

### Verify the IAM policy directly

Run these commands using the same AWS credentials configured in Vercel. Use a
throwaway key and delete it immediately:

```bash
aws sts get-caller-identity

printf 'iam-smoke-test' >/tmp/vaara-chat-iam-test.txt
aws s3api put-object \
  --bucket vaara-parents-connect \
  --key chat-media/iam-smoke-test/test.txt \
  --body /tmp/vaara-chat-iam-test.txt \
  --region ap-south-1

aws s3api head-object \
  --bucket vaara-parents-connect \
  --key chat-media/iam-smoke-test/test.txt \
  --region ap-south-1

aws s3api delete-object \
  --bucket vaara-parents-connect \
  --key chat-media/iam-smoke-test/test.txt \
  --region ap-south-1
```

All four commands must succeed. An `AccessDenied` response means the credentials
do not use the policy above, the resource ARN is wrong, or an organization SCP,
permissions boundary, or explicit bucket-policy deny overrides the allow.

### Verify chat privacy

Create another temporary object as above and, before deleting it, request the
same path through the CDN:

```bash
curl -I \
  https://media.vaara.ai/chat-media/iam-smoke-test/test.txt
```

Expected result: **403**, even though `head-object` with API credentials
succeeds. If CloudFront returns 200, the OAC bucket policy is too broad; fix
that before uploading real chat photos.

### Verify the app end to end

1. Open a circle message thread.
2. Attach one image and send it without text.
3. The upload PUT should return 200, message creation should return 201, and the
   message should display immediately.
4. Confirm another authorized circle member can view it.
5. Copying the object path to the CDN domain must still return 403.
6. Confirm a row exists in `circle_message_media` with a `storage_key` beginning
   `chat-media/{senderUserId}/`.

Post upload flow:

```text
App → POST /v1/media/upload-url → presigned PUT URL
App → PUT file to S3 (circle-media/…)
App → POST /v1/circles/…/posts with storageKey
API → HeadObject verify → save DB → feed returns CDN_BASE_URL/circle-media/…
```

Chat upload flow:

```text
App → POST /v1/media/upload-url with purpose="chat"
API → presigned PUT for chat-media/{userId}/…
App → PUT file directly to S3
App → POST /v1/circles/…/messages with storageKey
API → HeadObject verify with scope="chat" → save circle_message_media row
API → authorize chat reader → return short-lived presigned S3 GET
```

### Failure map

| Symptom | Most likely cause |
|---------|-------------------|
| Upload URL request succeeds, phone PUT returns 403 | IAM is missing `s3:PutObject` for `chat-media/*` |
| Message send says upload was not found | PUT failed, key/region is wrong, or object was removed |
| Message send returns “You do not own this file” | Key is outside `chat-media/{currentUserId}/` |
| Message exists but has no attachment row | Client omitted attachments or an outdated API/mobile bundle is running |
| Attachment row exists but image does not display | API lacks `GetObject`, signed URL expired, or mobile needs to refetch |
| CDN returns 200 for a `chat-media/*` key | Critical CloudFront OAC/bucket-policy exposure |

---

## Limits (API + UI)

| Limit | Value |
|-------|--------|
| Attachments per post | 4 |
| Image size | 10 MB |
| Video size | 100 MB |
| Target circles per post | 5 |

---

## Code reference (no changes needed)

| File | Role |
|------|------|
| `apps/api/src/lib/media-storage.ts` | Presign, verify, CDN URLs |
| `apps/api/src/routes/media.ts` | `/v1/media/status`, `/v1/media/upload-url` |
| `apps/api/src/routes/circles.ts` | Attach media to posts |
| `apps/mobile/app/circles/[circleId]/new-post.tsx` | Upload UI |
| `apps/api/src/lib/chat-attachments.ts` | Verify and persist chat attachments |
| `apps/api/src/routes/chat.ts` | Authorize chat attachment downloads |
| `apps/mobile/src/components/chat/ChatThreadScreen.tsx` | Chat attachment upload/send UI |

---

## Checklist

- [ ] Bucket `vaara-parents-connect` — block public access ON
- [ ] API IAM user can Put/Get/Delete `circle-media/*`, `listing-media/*`, and `chat-media/*`
- [ ] API IAM user can access the required `quarantine/*` and `post-docs/*` document operations
- [ ] CloudFront distribution + S3 bucket policy for OAC
- [ ] CloudFront OAC bucket policy only exposes `circle-media/*` and `listing-media/*`
- [ ] CDN request for a real `chat-media/*` object returns 403
- [ ] `CDN_BASE_URL` set (CloudFront or `media.vaara.ai`)
- [ ] Five env vars on **Vercel** → redeploy API
- [ ] Direct Put/Head/Delete IAM smoke test passes for `chat-media/*`
- [ ] Post upload works
- [ ] Chat image upload, message persistence, and authorized display work
