import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "@/lib/api";
import { resolveMediaBytes, uploadMediaBytes } from "@/lib/media-local";

export const MAX_POST_DOCUMENTS = 3;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_OFFICE_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type PendingDocumentStatus =
  | "uploading"
  | "scanning"
  | "clean"
  | "blocked"
  | "failed";

export type PendingDocument = {
  localId: string;
  id?: string;
  uri?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey?: string;
  status: PendingDocumentStatus;
  reason?: string;
};

function maxBytesForMime(mimeType: string): number {
  return mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_OFFICE_BYTES;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pickDocuments(
  remaining: number
): Promise<PendingDocument[]> {
  if (remaining <= 0) return [];

  const result = await DocumentPicker.getDocumentAsync({
    type: [...DOCUMENT_MIME_TYPES],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  const assets = result.assets ?? [];
  const picked: PendingDocument[] = [];
  const cacheRoot = FileSystem.cacheDirectory;
  const stableDir = cacheRoot ? `${cacheRoot}vaara-docs/` : null;
  if (stableDir) {
    await FileSystem.makeDirectoryAsync(stableDir, { intermediates: true }).catch(
      () => undefined
    );
  }

  for (const asset of assets) {
    if (picked.length >= remaining) break;
    const mimeType = (asset.mimeType ?? "").toLowerCase();
    if (
      !DOCUMENT_MIME_TYPES.includes(
        mimeType as (typeof DOCUMENT_MIME_TYPES)[number]
      )
    ) {
      continue;
    }
    const fileName = asset.name || "document";
    let uri = asset.uri;
    // Move out of DocumentPicker cache — Android may purge that folder quickly.
    if (stableDir && uri) {
      const dest = `${stableDir}${Date.now()}-${picked.length}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
      try {
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      } catch {
        // Keep picker URI; upload path will retry reading it.
      }
    }
    const sizeBytes = asset.size ?? 0;
    if (!sizeBytes || sizeBytes > maxBytesForMime(mimeType)) {
      picked.push({
        localId: `${Date.now()}-${picked.length}-${fileName}`,
        uri,
        fileName,
        mimeType,
        sizeBytes,
        status: "failed",
        reason:
          sizeBytes > maxBytesForMime(mimeType)
            ? `This file must be ${Math.round(maxBytesForMime(mimeType) / (1024 * 1024))} MB or smaller`
            : "Could not read this file",
      });
      continue;
    }
    picked.push({
      localId: `${Date.now()}-${picked.length}-${fileName}`,
      uri,
      fileName,
      mimeType,
      sizeBytes,
      status: "uploading",
    });
  }
  return picked;
}

export async function uploadAndScanDocument(
  token: string,
  doc: PendingDocument,
  onUpdate: (next: PendingDocument) => void
): Promise<PendingDocument> {
  if (doc.id || !doc.uri || doc.status === "blocked" || doc.status === "failed") {
    return doc;
  }

  let current: PendingDocument = { ...doc, status: "uploading" };
  onUpdate(current);

  try {
    const { sizeBytes, body } = await resolveMediaBytes(
      doc.uri,
      doc.fileName,
      doc.sizeBytes
    );
    if (sizeBytes > maxBytesForMime(doc.mimeType)) {
      current = {
        ...current,
        status: "failed",
        reason: `This file must be ${Math.round(maxBytesForMime(doc.mimeType) / (1024 * 1024))} MB or smaller`,
      };
      onUpdate(current);
      return current;
    }

    const upload = await api.createMediaUpload(token, {
      fileName: doc.fileName,
      mediaType: "document",
      mimeType: doc.mimeType,
      sizeBytes,
    });
    await uploadMediaBytes(
      upload.uploadUrl,
      body,
      doc.mimeType,
      doc.fileName
    );

    current = {
      ...current,
      sizeBytes,
      storageKey: upload.storageKey,
      status: "scanning",
    };
    onUpdate(current);

    const verified = await api.verifyDocument(token, {
      storageKey: upload.storageKey,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    });

    if (verified.status === "clean") {
      current = {
        ...current,
        status: "clean",
        storageKey: verified.storageKey,
        fileName: verified.fileName,
        sizeBytes: verified.sizeBytes,
        mimeType: verified.mimeType,
      };
      onUpdate(current);
      return current;
    }

    // Poll scan status up to ~60s.
    let storageKey = verified.storageKey;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await sleep(2000);
      const status = await api.getDocumentStatus(token, storageKey);
      if (status.status === "clean" && status.storageKey) {
        current = {
          ...current,
          status: "clean",
          storageKey: status.storageKey,
          fileName: status.fileName ?? current.fileName,
          sizeBytes: status.sizeBytes ?? current.sizeBytes,
          mimeType: status.mimeType ?? current.mimeType,
        };
        onUpdate(current);
        return current;
      }
      if (status.status === "blocked") {
        current = {
          ...current,
          status: "blocked",
          reason:
            status.reason ??
            "Blocked — this file failed the safety check and was not uploaded",
        };
        onUpdate(current);
        return current;
      }
      if (status.status === "failed") {
        current = {
          ...current,
          status: "failed",
          reason:
            status.reason ??
            "Could not check this file. Remove it and try again.",
        };
        onUpdate(current);
        return current;
      }
      if (status.storageKey) storageKey = status.storageKey;
    }

    current = {
      ...current,
      status: "failed",
      reason: "Could not check this file. Remove it and try again.",
    };
    onUpdate(current);
    return current;
  } catch (error) {
    current = {
      ...current,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "Could not check this file. Remove it and try again.",
    };
    onUpdate(current);
    return current;
  }
}

export function documentsBusy(docs: PendingDocument[]): boolean {
  return docs.some(
    (doc) => doc.status === "uploading" || doc.status === "scanning"
  );
}

export function cleanDocumentsForPayload(docs: PendingDocument[]) {
  return docs
    .filter((doc) => doc.status === "clean")
    .map((doc) =>
      doc.id
        ? { id: doc.id }
        : {
            storageKey: doc.storageKey as string,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
          }
    );
}

/** New posts can only attach freshly scanned keys — never `{ id }`. */
export function cleanDocumentsForCreate(docs: PendingDocument[]) {
  return docs
    .filter((doc) => doc.status === "clean" && doc.storageKey && !doc.id)
    .map((doc) => ({
      storageKey: doc.storageKey as string,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    }));
}
