export type FeedCursor = {
  createdAt: string;
  postId?: string;
};

export type HomeFeedPhase =
  | "primary"
  | "discovery"
  | "member_unseen"
  | "discovery_unseen"
  | "member_seen"
  | "discovery_seen";

export type HomeFeedCursor = FeedCursor & {
  phase: HomeFeedPhase;
  asOf?: string;
  relevance?: number;
  helpfulCount?: number;
  version?: 1 | 2;
};

const FRESHNESS_PHASES: HomeFeedPhase[] = [
  "member_unseen",
  "discovery_unseen",
  "member_seen",
  "discovery_seen",
];

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

export function isLegacyHomeCursor(cursor?: string | null): boolean {
  if (!cursor) return false;
  return !cursor.startsWith("v2.");
}

export function parseHomeFeedCursor(cursor?: string | null): HomeFeedCursor {
  if (!cursor) {
    return { phase: "primary", createdAt: "", version: 1 };
  }
  if (cursor.startsWith("v2.")) {
    try {
      const raw = Buffer.from(cursor.slice(3), "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as HomeFeedCursor;
      if (
        parsed &&
        typeof parsed.phase === "string" &&
        FRESHNESS_PHASES.includes(parsed.phase) &&
        typeof parsed.asOf === "string"
      ) {
        return {
          version: 2,
          phase: parsed.phase,
          asOf: parsed.asOf,
          createdAt: parsed.createdAt ?? "",
          postId: parsed.postId,
          relevance: parsed.relevance,
          helpfulCount: parsed.helpfulCount,
        };
      }
    } catch {
      return { phase: "primary", createdAt: "", version: 1 };
    }
    return { phase: "primary", createdAt: "", version: 1 };
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
    version: 1,
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

export function encodeHomeFeedCursorV2(cursor: {
  phase: HomeFeedPhase;
  asOf: string;
  createdAt: string;
  postId: string;
  relevance?: number;
  helpfulCount?: number;
}): string {
  return `v2.${Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")}`;
}

export function nextFreshnessPhase(
  phase: HomeFeedPhase
): HomeFeedPhase | null {
  const index = FRESHNESS_PHASES.indexOf(phase);
  if (index < 0 || index === FRESHNESS_PHASES.length - 1) return null;
  return FRESHNESS_PHASES[index + 1];
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
