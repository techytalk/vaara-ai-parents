# S3 and CDN setup (Vaara Parents)

Post photos/videos and marketplace images upload **directly from the phone to S3**
via a presigned URL. The API verifies each object, then stores the `storage_key`
in Postgres. **Reads** go through CloudFront (`CDN_BASE_URL`), not the S3 API.

## Your bucket

| Setting | Value |
|---------|--------|
| **Bucket** | `vaara-parents-connect` |
| **Region** | `ap-south-1` (Mumbai) |
| **Object prefixes** | `circle-media/{userId}/…`, `listing-media/{userId}/…` |
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

Create an IAM user (e.g. `vaara-api-media`) with **programmatic access** and attach
this policy (replace bucket name if it changes):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VaaraMediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::vaara-parents-connect/circle-media/*",
        "arn:aws:s3:::vaara-parents-connect/listing-media/*"
      ]
    }
  ]
}
```

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

Upload flow:

```text
App → POST /v1/media/upload-url → presigned PUT URL
App → PUT file to S3 (circle-media/…)
App → POST /v1/circles/…/posts with storageKey
API → HeadObject verify → save DB → feed returns CDN_BASE_URL/circle-media/…
```

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

---

## Checklist

- [ ] Bucket `vaara-parents-connect` — block public access ON
- [ ] IAM user + policy for `circle-media/*` and `listing-media/*`
- [ ] CloudFront distribution + S3 bucket policy for OAC
- [ ] `CDN_BASE_URL` set (CloudFront or `media.vaara.ai`)
- [ ] Five env vars on **Vercel** → redeploy API
- [ ] Test upload from app
