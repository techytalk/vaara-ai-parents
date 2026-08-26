import { randomUUID } from "node:crypto";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type MediaType = "image" | "video";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_POST_MEDIA = 4;

const bucket = process.env.S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim();
const cdnBaseUrl = process.env.CDN_BASE_URL?.trim().replace(/\/+$/, "");

const s3 =
  bucket && region
    ? new S3Client({
        region,
        endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      })
    : null;

export function isMediaStorageConfigured(): boolean {
  return Boolean(s3 && bucket && cdnBaseUrl);
}

export function mediaPublicUrl(storageKey: string): string {
  if (!cdnBaseUrl) throw new Error("CDN_BASE_URL is not configured");
  return `${cdnBaseUrl}/${storageKey}`;
}

function extensionFor(fileName: string, mimeType: string): string {
  const fileExtension = fileName
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (fileExtension && fileExtension.length <= 8) return fileExtension;

  const mimeExtensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return mimeExtensions[mimeType] ?? "bin";
}

export function validateMediaRequest(params: {
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
}): string | null {
  const expectedPrefix = `${params.mediaType}/`;
  if (!params.mimeType.startsWith(expectedPrefix)) {
    return `MIME type must be ${expectedPrefix}*`;
  }
  if (!Number.isSafeInteger(params.sizeBytes) || params.sizeBytes <= 0) {
    return "Invalid file size";
  }
  const maxBytes =
    params.mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (params.sizeBytes > maxBytes) {
    const maxMb = Math.round(maxBytes / 1024 / 1024);
    return `${params.mediaType === "image" ? "Images" : "Videos"} must be ${maxMb} MB or smaller`;
  }
  return null;
}

export async function createMediaUpload(params: {
  userId: string;
  fileName: string;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!s3 || !bucket || !cdnBaseUrl) {
    throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  }

  const extension = extensionFor(params.fileName, params.mimeType);
  const storageKey = `circle-media/${params.userId}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: params.mimeType,
    ContentLength: params.sizeBytes,
    Metadata: {
      owner: params.userId,
      mediaType: params.mediaType,
    },
  });

  return {
    storageKey,
    uploadUrl: await getSignedUrl(s3, command, { expiresIn: 600 }),
    publicUrl: mediaPublicUrl(storageKey),
    expiresInSeconds: 600,
  };
}

export async function verifyUploadedMedia(params: {
  userId: string;
  storageKey: string;
  mediaType: MediaType;
  mimeType: string;
}) {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith(`circle-media/${params.userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  const result = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: params.storageKey })
  );
  const sizeBytes = Number(result.ContentLength ?? 0);
  const storedMimeType = result.ContentType ?? params.mimeType;
  const error = validateMediaRequest({
    mediaType: params.mediaType,
    mimeType: storedMimeType,
    sizeBytes,
  });
  if (error) throw new Error(error);
  if (storedMimeType !== params.mimeType) {
    throw new Error("MEDIA_MIME_MISMATCH");
  }

  return { sizeBytes, mimeType: storedMimeType };
}
