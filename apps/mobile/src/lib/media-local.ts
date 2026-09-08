import * as FileSystem from "expo-file-system";

/**
 * Android gallery picks often return content:// URIs. expo-file-system cannot
 * reliably getInfo/upload those, but React Native's fetch can read the bytes
 * the system picker temporarily granted us. Prefer fetch; fall back to a
 * cache copy only for file:// paths that need uploadAsync.
 */

export async function resolveMediaBytes(
  uri: string,
  fileName: string,
  knownSize?: number
): Promise<{ sizeBytes: number; body: Blob }> {
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
    // Last resort: copy into app cache (helps some file:// / ph:// cases).
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) {
      throw new Error(
        `Could not read ${fileName}. Allow Photos access for Vaara in Android Settings, then pick the image again.`
      );
    }
    const dest = `${cacheRoot}upload-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_") || "media"}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      const sizeBytes =
        (info.exists && typeof info.size === "number" ? info.size : 0) ||
        knownSize ||
        0;
      if (!sizeBytes) {
        throw new Error("empty-copy");
      }
      const copied = await fetch(dest);
      const body = await copied.blob();
      return { sizeBytes: body.size || sizeBytes, body };
    } catch {
      throw new Error(
        `Could not read ${fileName}. Allow Photos access for Vaara in Android Settings, then pick the image again.`
      );
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
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Could not upload ${fileName} (HTTP ${response.status}${detail ? `: ${detail}` : ""})`
    );
  }
}
