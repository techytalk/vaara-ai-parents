import * as SecureStore from "expo-secure-store";

const PENDING_LINK_KEY = "vaara_pending_link";

const ALLOWED_PREFIXES = ["/p/", "/circles/"];

export async function savePendingLink(path: string) {
  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  await SecureStore.setItemAsync(PENDING_LINK_KEY, path);
}

export async function consumePendingLink(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(PENDING_LINK_KEY);
  if (value) {
    await SecureStore.deleteItemAsync(PENDING_LINK_KEY);
  }
  return value;
}

export function pathFromShareUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "vaara.ai") return null;
    if (parsed.pathname.startsWith("/p/")) return parsed.pathname;
    return null;
  } catch {
    if (url.startsWith("vaara-parents://p/")) {
      return url.replace("vaara-parents://", "/");
    }
    return null;
  }
}
