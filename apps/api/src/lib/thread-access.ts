import type { PoolClient } from "pg";
import { assertCircleMember } from "./author.js";
import { isDiscoveryPostReadable } from "../services/feed.js";

export type ThreadAccessState =
  | "member"
  | "author"
  | "discovery_preview"
  | "share_preview"
  | "denied";

export type ThreadCapabilities = {
  canViewPost: boolean;
  canViewReplies: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
  canMarkHelpful: boolean;
  canSave: boolean;
  canMessageAuthor: boolean;
  canOpenCircle: boolean;
  canReport: boolean;
};

export type CircleRow = {
  id: string;
  circle_type: string;
  key: string;
  display_name?: string;
  metadata: Record<string, unknown>;
};

export type ThreadAccess = {
  state: ThreadAccessState;
  capabilities: ThreadCapabilities;
  circle: CircleRow | null;
  postAuthorId: string | null;
};

const DENIED_CAPABILITIES: ThreadCapabilities = {
  canViewPost: false,
  canViewReplies: false,
  canReply: false,
  canEdit: false,
  canDelete: false,
  canVote: false,
  canMarkHelpful: false,
  canSave: false,
  canMessageAuthor: false,
  canOpenCircle: false,
  canReport: false,
};

export function capabilitiesFor(
  state: ThreadAccessState,
  viewerId: string,
  postAuthorId: string | null
): ThreadCapabilities {
  const isOwn = Boolean(postAuthorId && viewerId === postAuthorId);
  switch (state) {
    case "member":
      return {
        canViewPost: true,
        canViewReplies: true,
        canReply: true,
        canEdit: isOwn,
        canDelete: isOwn,
        canVote: true,
        canMarkHelpful: !isOwn,
        canSave: true,
        canMessageAuthor: !isOwn,
        canOpenCircle: true,
        canReport: !isOwn,
      };
    case "author":
      return {
        canViewPost: true,
        canViewReplies: true,
        canReply: true,
        canEdit: true,
        canDelete: true,
        canVote: false,
        canMarkHelpful: false,
        canSave: true,
        canMessageAuthor: false,
        canOpenCircle: false,
        canReport: false,
      };
    case "discovery_preview":
    case "share_preview":
      return {
        canViewPost: true,
        canViewReplies: false,
        canReply: false,
        canEdit: false,
        canDelete: false,
        canVote: false,
        canMarkHelpful: false,
        canSave: false,
        canMessageAuthor: false,
        canOpenCircle: false,
        canReport: !isOwn,
      };
    default:
      return DENIED_CAPABILITIES;
  }
}

export async function loadCircleRow(
  client: PoolClient,
  circleId: string
): Promise<CircleRow | null> {
  const { rows } = await client.query(
    `SELECT id, circle_type, key, display_name, metadata
     FROM circles WHERE id = $1`,
    [circleId]
  );
  return rows.length > 0 ? (rows[0] as CircleRow) : null;
}

export async function loadShareTarget(
  client: PoolClient,
  shareId: string
): Promise<{
  postId: string;
  circleId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
} | null> {
  const { rows } = await client.query(
    `SELECT post_id, target_circle_id, expires_at, revoked_at
     FROM post_shares WHERE id = $1`,
    [shareId]
  );
  if (rows.length === 0) return null;
  return {
    postId: String(rows[0].post_id),
    circleId: String(rows[0].target_circle_id),
    expiresAt: rows[0].expires_at ? new Date(rows[0].expires_at) : null,
    revokedAt: rows[0].revoked_at ? new Date(rows[0].revoked_at) : null,
  };
}

export function isShareActive(share: {
  expiresAt: Date | null;
  revokedAt: Date | null;
}): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function resolveThreadAccess(
  client: PoolClient,
  params: {
    userId: string;
    circleId: string;
    postId: string;
    shareId?: string | null;
  }
): Promise<ThreadAccess> {
  const denied: ThreadAccess = {
    state: "denied",
    capabilities: DENIED_CAPABILITIES,
    circle: null,
    postAuthorId: null,
  };

  const postResult = await client.query(
    `SELECT p.id, p.author_id
     FROM circle_posts p
     WHERE p.id = $1
       AND EXISTS (
         SELECT 1 FROM circle_post_targets pct
         WHERE pct.post_id = p.id AND pct.circle_id = $2
       )`,
    [params.postId, params.circleId]
  );
  if (postResult.rows.length === 0) return denied;

  const postAuthorId = String(postResult.rows[0].author_id);
  const memberCircle = await assertCircleMember(
    client,
    params.circleId,
    params.userId
  );
  if (memberCircle) {
    return {
      state: "member",
      capabilities: capabilitiesFor("member", params.userId, postAuthorId),
      circle: memberCircle,
      postAuthorId,
    };
  }

  // Shared multi-circle post: membership in any target grants full thread access.
  // Keeps the door open for richer cross-circle feed surfacing later.
  const anyTargetMember = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata
     FROM circle_post_targets pct
     JOIN circle_members cm
       ON cm.circle_id = pct.circle_id AND cm.user_id = $1
     JOIN circles c ON c.id = pct.circle_id
     WHERE pct.post_id = $2
     LIMIT 1`,
    [params.userId, params.postId]
  );
  if (anyTargetMember.rows.length > 0) {
    return {
      state: "member",
      capabilities: capabilitiesFor("member", params.userId, postAuthorId),
      circle: anyTargetMember.rows[0] as CircleRow,
      postAuthorId,
    };
  }

  const circle = await loadCircleRow(client, params.circleId);
  if (!circle) return denied;

  if (postAuthorId === params.userId) {
    return {
      state: "author",
      capabilities: capabilitiesFor("author", params.userId, postAuthorId),
      circle,
      postAuthorId,
    };
  }

  if (params.shareId) {
    const share = await loadShareTarget(client, params.shareId);
    if (
      share &&
      isShareActive(share) &&
      share.postId === params.postId &&
      share.circleId === params.circleId
    ) {
      return {
        state: "share_preview",
        capabilities: capabilitiesFor(
          "share_preview",
          params.userId,
          postAuthorId
        ),
        circle,
        postAuthorId,
      };
    }
  }

  const discoveryReadable = await isDiscoveryPostReadable(
    client,
    params.userId,
    params.circleId,
    params.postId
  );
  if (discoveryReadable) {
    return {
      state: "discovery_preview",
      capabilities: capabilitiesFor(
        "discovery_preview",
        params.userId,
        postAuthorId
      ),
      circle,
      postAuthorId,
    };
  }

  return denied;
}
