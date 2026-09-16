export type ChatHomeCursor = {
  bucket: number;
  lastAt: string;
  id: string;
};

export function encodeChatHomeCursor(cursor: ChatHomeCursor): string {
  return `ch1.${Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")}`;
}

export function parseChatHomeCursor(cursor?: string | null): ChatHomeCursor | null {
  if (!cursor?.startsWith("ch1.")) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.slice(4), "base64url").toString("utf8")
    ) as ChatHomeCursor;
    if (
      typeof parsed.bucket === "number" &&
      typeof parsed.lastAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/** True when `row` sorts after the cursor (bucket ASC, lastAt DESC, id DESC). */
export function isAfterChatHomeCursor(
  row: ChatHomeCursor,
  cursor: ChatHomeCursor
): boolean {
  if (row.bucket !== cursor.bucket) return row.bucket > cursor.bucket;
  if (row.lastAt !== cursor.lastAt) return row.lastAt < cursor.lastAt;
  return row.id < cursor.id;
}
