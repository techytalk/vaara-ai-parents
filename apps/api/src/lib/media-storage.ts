import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type MediaType = "image" | "video" | "document";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_OFFICE_BYTES = 10 * 1024 * 1024;
export const MAX_POST_MEDIA = 4;
export const MAX_POST_DOCUMENTS = 3;

export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

const ALLOWED_DOCUMENT_MIMES = new Set<string>(Object.values(DOCUMENT_MIME_TYPES));

const DOCUMENT_EXT_BY_MIME: Record<string, string> = {
  [DOCUMENT_MIME_TYPES.pdf]: "pdf",
  [DOCUMENT_MIME_TYPES.docx]: "docx",
  [DOCUMENT_MIME_TYPES.xlsx]: "xlsx",
};

const MIME_BY_DOCUMENT_EXT: Record<string, string> = {
  pdf: DOCUMENT_MIME_TYPES.pdf,
  docx: DOCUMENT_MIME_TYPES.docx,
  xlsx: DOCUMENT_MIME_TYPES.xlsx,
};

const REJECTED_DOCUMENT_EXTS = new Set([
  "docm",
  "xlsm",
  "xlsb",
  "doc",
  "xls",
  "exe",
  "apk",
  "zip",
  "rar",
  "7z",
]);

const bucket = process.env.S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim();
const cdnBaseUrl = process.env.CDN_BASE_URL?.trim().replace(/\/+$/, "");

/** When false/undefined, verify promotes immediately after magic-byte checks (local/dev). */
export function isGuardDutyDocumentScanningEnabled(): boolean {
  return process.env.GUARDDUTY_MALWARE_PROTECTION_ENABLED === "true";
}

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
    ...DOCUMENT_EXT_BY_MIME,
  };
  return mimeExtensions[mimeType] ?? "bin";
}

function fileExtension(fileName: string): string {
  return (
    fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""
  );
}

export function validateMediaRequest(params: {
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
  fileName?: string;
}): string | null {
  if (!Number.isSafeInteger(params.sizeBytes) || params.sizeBytes <= 0) {
    return "Invalid file size";
  }

  if (params.mediaType === "document") {
    if (!ALLOWED_DOCUMENT_MIMES.has(params.mimeType)) {
      return "Only PDF, Word (.docx), and Excel (.xlsx) files are allowed";
    }
    const ext = fileExtension(params.fileName ?? "");
    if (REJECTED_DOCUMENT_EXTS.has(ext)) {
      return "This file type is not allowed";
    }
    const expectedExt = DOCUMENT_EXT_BY_MIME[params.mimeType];
    if (ext && expectedExt && ext !== expectedExt) {
      return "File extension does not match the file type";
    }
    if (ext && MIME_BY_DOCUMENT_EXT[ext] && MIME_BY_DOCUMENT_EXT[ext] !== params.mimeType) {
      return "File extension does not match the file type";
    }
    const maxBytes =
      params.mimeType === DOCUMENT_MIME_TYPES.pdf
        ? MAX_PDF_BYTES
        : MAX_OFFICE_BYTES;
    if (params.sizeBytes > maxBytes) {
      const maxMb = Math.round(maxBytes / 1024 / 1024);
      return `This document must be ${maxMb} MB or smaller`;
    }
    return null;
  }

  const expectedPrefix = `${params.mediaType}/`;
  if (!params.mimeType.startsWith(expectedPrefix)) {
    return `MIME type must be ${expectedPrefix}*`;
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

  const error = validateMediaRequest({
    mediaType: params.mediaType,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    fileName: params.fileName,
  });
  if (error) throw new Error(error);

  const extension = extensionFor(params.fileName, params.mimeType);
  const prefix =
    params.mediaType === "document"
      ? `quarantine/${params.userId}`
      : `circle-media/${params.userId}`;
  const storageKey = `${prefix}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: params.mimeType,
    Metadata: {
      owner: params.userId,
      mediaType: params.mediaType,
      fileName: sanitizeFileName(params.fileName).slice(0, 180),
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
  if (params.mediaType === "document") {
    return {
      storageKey,
      uploadUrl,
      expiresInSeconds: 600,
    };
  }

  return {
    storageKey,
    uploadUrl,
    publicUrl: mediaPublicUrl(storageKey),
    expiresInSeconds: 600,
  };
}

export async function verifyUploadedMedia(params: {
  userId: string;
  storageKey: string;
  mediaType: Exclude<MediaType, "document">;
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

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "document";
  return base.replace(/[^\w.\- ()[\]]+/g, "_") || "document";
}

async function readObjectPrefix(
  storageKey: string,
  maxBytes = 8192
): Promise<Buffer> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Range: `bytes=0-${maxBytes - 1}`,
    })
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes || bytes.length === 0) {
    throw new Error("EMPTY_OBJECT");
  }
  return Buffer.from(bytes);
}

function zipContainsEntry(buffer: Buffer, entryName: string): boolean {
  const needle = Buffer.from(entryName, "utf8");
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]); // central directory file header
  let offset = 0;
  while (offset < buffer.length) {
    const index = buffer.indexOf(signature, offset);
    if (index < 0 || index + 46 > buffer.length) break;
    const nameLength = buffer.readUInt16LE(index + 28);
    const nameStart = index + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;
    const name = buffer.subarray(nameStart, nameEnd);
    if (name.equals(needle) || name.toString("utf8").endsWith(`/${entryName}`)) {
      return true;
    }
    offset = nameEnd;
  }
  // Also scan local headers for small files where central dir may be beyond range
  const localSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  offset = 0;
  while (offset < buffer.length) {
    const index = buffer.indexOf(localSig, offset);
    if (index < 0 || index + 30 > buffer.length) break;
    const nameLength = buffer.readUInt16LE(index + 26);
    const extraLength = buffer.readUInt16LE(index + 28);
    const nameStart = index + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    if (name === entryName || name.endsWith(`/${entryName}`)) {
      return true;
    }
    offset = nameEnd + extraLength;
  }
  return false;
}

function assertDocumentMagicBytes(mimeType: string, buffer: Buffer): void {
  if (mimeType === DOCUMENT_MIME_TYPES.pdf) {
    if (!buffer.subarray(0, 5).toString("utf8").startsWith("%PDF-")) {
      throw new Error("INVALID_DOCUMENT_FORMAT");
    }
    return;
  }

  if (
    mimeType === DOCUMENT_MIME_TYPES.docx ||
    mimeType === DOCUMENT_MIME_TYPES.xlsx
  ) {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      throw new Error("INVALID_DOCUMENT_FORMAT");
    }
    if (!zipContainsEntry(buffer, "[Content_Types].xml")) {
      throw new Error("INVALID_DOCUMENT_FORMAT");
    }
    if (
      zipContainsEntry(buffer, "vbaProject.bin") ||
      zipContainsEntry(buffer, "vbaProject.bin/")
    ) {
      throw new Error("MACROS_NOT_ALLOWED");
    }
    return;
  }

  throw new Error("INVALID_DOCUMENT_FORMAT");
}

async function deleteObject(storageKey: string): Promise<void> {
  if (!s3 || !bucket) return;
  await s3.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })
  );
}

async function promoteQuarantineObject(params: {
  userId: string;
  quarantineKey: string;
}): Promise<string> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.quarantineKey.startsWith(`quarantine/${params.userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  const fileName = params.quarantineKey.split("/").pop() || "document.bin";
  const destKey = `post-docs/${params.userId}/${fileName}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${params.quarantineKey}`,
      Key: destKey,
      MetadataDirective: "COPY",
    })
  );
  await deleteObject(params.quarantineKey);
  return destKey;
}

export type DocumentVerifyResult =
  | {
      status: "scanning";
      storageKey: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
    }
  | {
      status: "clean";
      storageKey: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
    };

/**
 * Layers 3–5: HeadObject, magic bytes, macro block.
 * With GuardDuty enabled → leave in quarantine and return scanning.
 * Without GuardDuty (local/dev) → promote immediately to post-docs/.
 */
export async function verifyUploadedDocument(params: {
  userId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
}): Promise<DocumentVerifyResult> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith(`quarantine/${params.userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  const fileName = sanitizeFileName(params.fileName);
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: params.storageKey })
    );
    const sizeBytes = Number(head.ContentLength ?? 0);
    const storedMimeType = (head.ContentType ?? params.mimeType).toLowerCase();
    const error = validateMediaRequest({
      mediaType: "document",
      mimeType: storedMimeType,
      sizeBytes,
      fileName,
    });
    if (error) throw new Error(error);
    if (storedMimeType !== params.mimeType.toLowerCase()) {
      throw new Error("MEDIA_MIME_MISMATCH");
    }

    const prefix = await readObjectPrefix(params.storageKey);
    assertDocumentMagicBytes(storedMimeType, prefix);

    if (isGuardDutyDocumentScanningEnabled()) {
      return {
        status: "scanning",
        storageKey: params.storageKey,
        fileName,
        sizeBytes,
        mimeType: storedMimeType,
      };
    }

    const promotedKey = await promoteQuarantineObject({
      userId: params.userId,
      quarantineKey: params.storageKey,
    });
    return {
      status: "clean",
      storageKey: promotedKey,
      fileName,
      sizeBytes,
      mimeType: storedMimeType,
    };
  } catch (error) {
    await deleteObject(params.storageKey).catch(() => undefined);
    throw error;
  }
}

export type DocumentScanStatus =
  | {
      status: "clean";
      storageKey: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
    }
  | { status: "scanning" }
  | { status: "blocked"; reason: string }
  | { status: "failed"; reason: string };

function guardDutyTagVerdict(
  tags: Array<{ Key?: string; Value?: string }>
): "clean" | "blocked" | "failed" | "scanning" {
  const tag =
    tags.find((t) => t.Key === "GuardDutyMalwareScanStatus")?.Value ??
    tags.find((t) => t.Key === "GuardDutyMalwareProtectionScanStatus")?.Value;

  if (!tag) return "scanning";
  const normalized = tag.toUpperCase();
  if (
    normalized === "NO_THREATS_FOUND" ||
    normalized === "NO_THREATS" ||
    normalized === "CLEAN"
  ) {
    return "clean";
  }
  if (
    normalized === "THREATS_FOUND" ||
    normalized === "THREATS" ||
    normalized === "INFECTED"
  ) {
    return "blocked";
  }
  if (
    normalized === "UNSUPPORTED" ||
    normalized === "ACCESS_DENIED" ||
    normalized === "FAILED" ||
    normalized === "UNSUPPORTED_TYPE"
  ) {
    return "failed";
  }
  return "scanning";
}

export async function resolveDocumentScanStatus(params: {
  userId: string;
  storageKey: string;
}): Promise<DocumentScanStatus> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");

  const { storageKey, userId } = params;

  if (storageKey.startsWith(`post-docs/${userId}/`)) {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
    );
    return {
      status: "clean",
      storageKey,
      fileName: sanitizeFileName(
        head.Metadata?.filename ?? storageKey.split("/").pop() ?? "document"
      ),
      sizeBytes: Number(head.ContentLength ?? 0),
      mimeType: (head.ContentType ?? "application/octet-stream").toLowerCase(),
    };
  }

  if (!storageKey.startsWith(`quarantine/${userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  if (!isGuardDutyDocumentScanningEnabled()) {
    // Dev path: promote on status poll if still in quarantine.
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
    );
    const mimeType = (head.ContentType ?? "application/octet-stream").toLowerCase();
    const fileName = sanitizeFileName(
      head.Metadata?.filename ?? storageKey.split("/").pop() ?? "document"
    );
    const prefix = await readObjectPrefix(storageKey);
    assertDocumentMagicBytes(mimeType, prefix);
    const promotedKey = await promoteQuarantineObject({
      userId,
      quarantineKey: storageKey,
    });
    return {
      status: "clean",
      storageKey: promotedKey,
      fileName,
      sizeBytes: Number(head.ContentLength ?? 0),
      mimeType,
    };
  }

  let tags: Array<{ Key?: string; Value?: string }> = [];
  try {
    const tagging = await s3.send(
      new GetObjectTaggingCommand({ Bucket: bucket, Key: storageKey })
    );
    tags = tagging.TagSet ?? [];
  } catch {
    return { status: "scanning" };
  }

  const verdict = guardDutyTagVerdict(tags);
  if (verdict === "scanning") {
    return { status: "scanning" };
  }

  if (verdict === "blocked") {
    await deleteObject(storageKey).catch(() => undefined);
    return {
      status: "blocked",
      reason: "This file failed the safety check and was not uploaded",
    };
  }

  if (verdict === "failed") {
    await deleteObject(storageKey).catch(() => undefined);
    return {
      status: "failed",
      reason: "Could not check this file. Remove it and try again.",
    };
  }

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
  );
  const mimeType = (head.ContentType ?? "application/octet-stream").toLowerCase();
  const fileName = sanitizeFileName(
    head.Metadata?.filename ?? storageKey.split("/").pop() ?? "document"
  );
  const sizeBytes = Number(head.ContentLength ?? 0);
  const promotedKey = await promoteQuarantineObject({
    userId,
    quarantineKey: storageKey,
  });
  return {
    status: "clean",
    storageKey: promotedKey,
    fileName,
    sizeBytes,
    mimeType,
  };
}

/** EventBridge / GuardDuty callback helper. */
export async function applyGuardDutyScanResult(params: {
  storageKey: string;
  scanStatus: string;
}): Promise<"promoted" | "deleted" | "ignored"> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith("quarantine/")) {
    return "ignored";
  }

  const parts = params.storageKey.split("/");
  const userId = parts[1];
  if (!userId) return "ignored";

  const normalized = params.scanStatus.toUpperCase();
  if (
    normalized === "THREATS_FOUND" ||
    normalized === "THREATS" ||
    normalized === "INFECTED"
  ) {
    await deleteObject(params.storageKey).catch(() => undefined);
    return "deleted";
  }
  if (
    normalized === "UNSUPPORTED" ||
    normalized === "ACCESS_DENIED" ||
    normalized === "FAILED" ||
    normalized === "UNSUPPORTED_TYPE"
  ) {
    await deleteObject(params.storageKey).catch(() => undefined);
    return "deleted";
  }
  if (
    normalized === "NO_THREATS_FOUND" ||
    normalized === "NO_THREATS" ||
    normalized === "CLEAN"
  ) {
    // Idempotent: if already gone from quarantine, treat as done.
    try {
      await promoteQuarantineObject({
        userId,
        quarantineKey: params.storageKey,
      });
      return "promoted";
    } catch {
      return "ignored";
    }
  }
  return "ignored";
}

export async function verifyCleanDocumentForPost(params: {
  userId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
}): Promise<{ sizeBytes: number; mimeType: string; fileName: string }> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith(`post-docs/${params.userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: params.storageKey })
  );
  const sizeBytes = Number(head.ContentLength ?? 0);
  const storedMimeType = (head.ContentType ?? params.mimeType).toLowerCase();
  const fileName = sanitizeFileName(params.fileName);
  const error = validateMediaRequest({
    mediaType: "document",
    mimeType: storedMimeType,
    sizeBytes,
    fileName,
  });
  if (error) throw new Error(error);
  return { sizeBytes, mimeType: storedMimeType, fileName };
}

export async function createDocumentDownloadUrl(params: {
  storageKey: string;
  fileName: string;
  mimeType: string;
  expiresInSeconds?: number;
}): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith("post-docs/")) {
    throw new Error("INVALID_MEDIA_KEY");
  }

  const expiresInSeconds = params.expiresInSeconds ?? 60;
  const safeName = sanitizeFileName(params.fileName).replace(/"/g, "");
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ResponseContentType: params.mimeType,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
  });
  const downloadUrl = await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });
  return { downloadUrl, expiresInSeconds };
}

/** Best-effort removal of uploaded circle/listing/document media objects from S3. */
export async function deleteStoredMedia(storageKeys: string[]): Promise<void> {
  if (!s3 || !bucket || storageKeys.length === 0) return;

  const keys = [
    ...new Set(
      storageKeys.filter(
        (key) =>
          key.startsWith("circle-media/") ||
          key.startsWith("listing-media/") ||
          key.startsWith("quarantine/") ||
          key.startsWith("post-docs/")
      )
    ),
  ];
  if (keys.length === 0) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    })
  );
}

export async function createListingMediaUpload(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!s3 || !bucket || !cdnBaseUrl) {
    throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  }

  const error = validateMediaRequest({
    mediaType: "image",
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
  });
  if (error) throw new Error(error);

  const extension = extensionFor(params.fileName, params.mimeType);
  const storageKey = `listing-media/${params.userId}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: params.mimeType,
    Metadata: {
      owner: params.userId,
      mediaType: "image",
    },
  });

  return {
    storageKey,
    uploadUrl: await getSignedUrl(s3, command, { expiresIn: 600 }),
    publicUrl: mediaPublicUrl(storageKey),
    expiresInSeconds: 600,
  };
}

export async function verifyListingMedia(params: {
  userId: string;
  storageKey: string;
  mimeType: string;
}) {
  if (!s3 || !bucket) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  if (!params.storageKey.startsWith(`listing-media/${params.userId}/`)) {
    throw new Error("INVALID_MEDIA_OWNER");
  }

  const result = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: params.storageKey })
  );
  const sizeBytes = Number(result.ContentLength ?? 0);
  const storedMimeType = result.ContentType ?? params.mimeType;
  const error = validateMediaRequest({
    mediaType: "image",
    mimeType: storedMimeType,
    sizeBytes,
  });
  if (error) throw new Error(error);
  if (storedMimeType !== params.mimeType) {
    throw new Error("MEDIA_MIME_MISMATCH");
  }

  return { sizeBytes, mimeType: storedMimeType };
}
