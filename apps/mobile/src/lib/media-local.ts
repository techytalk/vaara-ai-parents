import * as FileSystem from "expo-file-system";

/**
 * Android gallery picks often return content:// URIs. Those grants are temporary
 * and are commonly revoked when another picker (e.g. documents) opens. Copy
 * into app cache immediately after pick so later uploads still work.
 *
 * Prefer fetch for reading; fall back to FileSystem for file:// paths.
 */

function isFileUri(uri: string): boolean {
  return uri.startsWith("file:");
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_") || "media";
}

/** Copy picker URI into durable cache while the temporary grant is still valid. */
export async function persistPickedMediaUri(
  uri: string,
  fileName: string
): Promise<string> {
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) return uri;

  // Already under our cache — nothing to do.
  if (uri.startsWith(cacheRoot) && uri.includes("vaara-media/")) {
    return uri;
  }

  const dir = `${cacheRoot}vaara-media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined
  );
  const dest = `${dir}${Date.now()}-${safeFileName(fileName)}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    // Keep original; upload may still succeed if grant remains.
    return uri;
  }
}

async function blobFromFileUri(
  uri: string,
  knownSize?: number
): Promise<{ sizeBytes: number; body: Blob }> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) {
    throw new Error("missing");
  }
  const sizeFromInfo =
    typeof info.size === "number" && info.size > 0 ? info.size : 0;

  // Prefer fetch for file:// — avoids loading large files as base64 in JS.
  try {
    const response = await fetch(uri);
    if (response.ok) {
      const body = await response.blob();
      const sizeBytes = body.size || sizeFromInfo || knownSize || 0;
      if (sizeBytes) return { sizeBytes, body };
    }
  } catch {
    // fall through to base64 read
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error("empty");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const body = new Blob([bytes]);
  const sizeBytes = body.size || sizeFromInfo || knownSize || 0;
  if (!sizeBytes) throw new Error("empty");
  return { sizeBytes, body };
}

function readFailedMessage(fileName: string): string {
  const lower = fileName.toLowerCase();
  const looksLikeDocument =
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".xls");
  if (looksLikeDocument) {
    return `Could not read ${fileName}. Remove it and attach the file again.`;
  }
  const kind =
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".webm")
      ? "video"
      : "image";
  return `Could not read ${fileName}. Remove it and pick the ${kind} again (after attaching a document, re-pick media if needed).`;
}

export async function resolveMediaBytes(
  uri: string,
  fileName: string,
  knownSize?: number
): Promise<{ sizeBytes: number; body: Blob }> {
  if (isFileUri(uri)) {
    try {
      return await blobFromFileUri(uri, knownSize);
    } catch {
      throw new Error(readFailedMessage(fileName));
    }
  }

  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.blob();
    const sizeBytes = body.size || knownSize || 0;
    if (!sizeBytes) {
      throw new Error("empty");
    }
    return { sizeBytes, body };
  } catch {
    // Last resort: copy into app cache (helps some content:// / ph:// cases).
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) {
      throw new Error(readFailedMessage(fileName));
    }
    const dest = `${cacheRoot}upload-${Date.now()}-${safeFileName(fileName)}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return await blobFromFileUri(dest, knownSize);
    } catch {
      throw new Error(readFailedMessage(fileName));
    }
  }
}

export async function uploadMediaBytes(
  uploadUrl: string,
  body: Blob,
  mimeType: string,
  fileName: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    const code =
      detail.match(/<Code>([^<]+)<\/Code>/i)?.[1] ??
      detail.match(/"Code"\s*:\s*"([^"]+)"/)?.[1];
    if (response.status === 403) {
      throw new Error(
        `Could not upload ${fileName} (access denied${code ? `: ${code}` : ""})`
      );
    }
    throw new Error(
      `Could not upload ${fileName} (HTTP ${response.status}${code ? `: ${code}` : ""})`
    );
  }
}
