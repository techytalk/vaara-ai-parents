export type FeedCursor = {
  createdAt: string;
  postId?: string;
};

export type HomeFeedPhase = "primary" | "discovery";

export type HomeFeedCursor = FeedCursor & {
  phase: HomeFeedPhase;
};

export function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function parseFeedCursor(cursor?: string | null): FeedCursor | null {
  if (!cursor) return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  const sep = trimmed.lastIndexOf("|");
  if (sep > 0) {
    const createdAt = trimmed.slice(0, sep);
    const postId = trimmed.slice(sep + 1);
    if (createdAt && postId && !createdAt.startsWith("p") && !createdAt.startsWith("d")) {
      return { createdAt, postId };
    }
  }
  return { createdAt: trimmed };
}

export function encodeFeedCursor(createdAt: string, postId: string): string {
  return `${createdAt}|${postId}`;
}

export function parseHomeFeedCursor(cursor?: string | null): HomeFeedCursor {
  if (!cursor) {
    return { phase: "primary", createdAt: "" };
  }
  let phase: HomeFeedPhase = "primary";
  let rest = cursor;
  if (cursor.startsWith("d|")) {
    phase = "discovery";
    rest = cursor.slice(2);
  } else if (cursor.startsWith("p|")) {
    phase = "primary";
    rest = cursor.slice(2);
  }
  const parsed = parseFeedCursor(rest);
  return {
    phase,
    createdAt: parsed?.createdAt ?? rest,
    postId: parsed?.postId,
  };
}

export function encodeHomeFeedCursor(
  phase: HomeFeedPhase,
  createdAt: string,
  postId: string
): string {
  return `${phase === "primary" ? "p" : "d"}|${encodeFeedCursor(createdAt, postId)}`;
}

export function exclusiveCreatedAtSql(
  createdAtParam: string,
  postIdParam?: string
): { sql: string; params: unknown[] } {
  if (postIdParam) {
    return {
      sql: `(p.created_at < ${createdAtParam}::timestamptz OR (p.created_at = ${createdAtParam}::timestamptz AND p.id < ${postIdParam}::uuid))`,
      params: [],
    };
  }
  return {
    sql: `p.created_at < ${createdAtParam}::timestamptz`,
    params: [],
  };
}
