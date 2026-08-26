# S3 and CDN setup for circle post media

Circle attachments upload directly from the mobile app to S3 through a
10-minute presigned URL. The API validates each uploaded object before linking
it to a post. Public reads should go through CloudFront (or another CDN), not
the S3 API endpoint.

## Required environment variables

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=vaara-circle-media
CDN_BASE_URL=https://media.example.com
```

The IAM principal used by the API only needs object access under
`circle-media/*`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::vaara-circle-media/circle-media/*"
    }
  ]
}
```

Keep the bucket private. Configure CloudFront with Origin Access Control and
allow it to read objects from the bucket. Set `CDN_BASE_URL` to the CloudFront
distribution domain or its custom domain.

For Expo web or other browser clients, add S3 CORS:

```json
[
  {
    "AllowedHeaders": ["content-type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://your-app-domain.example"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Limits enforced by both the API and UI:

- Up to 4 attachments per post
- Images: 10 MB each
- Videos: 100 MB each
- Up to 5 target circles per post
