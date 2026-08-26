import type { PoolClient } from "pg";
import { buildReviewAuthorView } from "../lib/author.js";
import { createNotification } from "./notifications.js";

export type DisclosureLevel = 0 | 1 | 2 | 3;

export type PeerView = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
  disclosureLevel: DisclosureLevel;
  firstName?: string;
  blockOrFlat?: string;
  fullName?: string;
  contactPhone?: string;
  vehicleDescription?: string;
};

async function getPeerId(
  client: PoolClient,
  conversationId: string,
  viewerId: string
): Promise<string | null> {
  const { rows } = await client.query(
    `SELECT user_a_id, user_b_id FROM conversations WHERE id = $1`,
    [conversationId]
  );
  if (rows.length === 0) return null;
  const conv = rows[0];
  if (conv.user_a_id === viewerId) return conv.user_b_id;
  if (conv.user_b_id === viewerId) return conv.user_a_id;
  return null;
}

async function getOfferedLevel(
  client: PoolClient,
  conversationId: string,
  userId: string
): Promise<DisclosureLevel> {
  const { rows } = await client.query(
    `SELECT offered_level FROM conversation_disclosures
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return (rows[0]?.offered_level ?? 0) as DisclosureLevel;
}

export async function getEffectiveLevel(
  client: PoolClient,
  conversationId: string
): Promise<DisclosureLevel> {
  const { rows } = await client.query(
    `SELECT MIN(offered_level)::int AS level
     FROM conversation_disclosures
     WHERE conversation_id = $1`,
    [conversationId]
  );
  if (rows.length === 0 || rows[0].level == null) return 0;
  return rows[0].level as DisclosureLevel;
}

export async function getDisclosureState(
  client: PoolClient,
  conversationId: string,
  viewerId: string
) {
  const peerId = await getPeerId(client, conversationId, viewerId);
  if (!peerId) return null;

  const ownOffer = await getOfferedLevel(client, conversationId, viewerId);
  const peerOffer = await getOfferedLevel(client, conversationId, peerId);
  const effectiveLevel = Math.min(ownOffer, peerOffer) as DisclosureLevel;

  return {
    effectiveLevel,
    ownOffer,
    peerOffer,
    peerId,
  };
}

export async function buildPeerView(
  client: PoolClient,
  params: { conversationId: string; viewerId: string }
): Promise<PeerView | null> {
  const peerId = await getPeerId(client, params.conversationId, params.viewerId);
  if (!peerId) return null;

  const userRow = await client.query(
    "SELECT anonymous_handle FROM users WHERE id = $1",
    [peerId]
  );
  if (userRow.rows.length === 0) return null;

  const author = await buildReviewAuthorView(
    client,
    peerId,
    userRow.rows[0].anonymous_handle
  );

  const ownOffer = await getOfferedLevel(
    client,
    params.conversationId,
    params.viewerId
  );
  const peerOffer = await getOfferedLevel(
    client,
    params.conversationId,
    peerId
  );
  const effectiveLevel = Math.min(ownOffer, peerOffer) as DisclosureLevel;

  const view: PeerView = {
    userId: peerId,
    anonymousHandle: author.anonymousHandle,
    contextLabel: author.contextLabel,
    disclosureLevel: effectiveLevel,
  };

  if (effectiveLevel >= 2) {
    const contact = await client.query(
      `SELECT first_name, block_or_flat, contact_phone, vehicle_description
       FROM user_contact_details WHERE user_id = $1`,
      [peerId]
    );
    if (contact.rows.length > 0) {
      view.firstName = contact.rows[0].first_name ?? undefined;
      view.blockOrFlat = contact.rows[0].block_or_flat ?? undefined;
    }
  }

  if (effectiveLevel >= 3) {
    const contact = await client.query(
      `SELECT ucd.contact_phone, ucd.vehicle_description, u.display_name
       FROM user_contact_details ucd
       JOIN users u ON u.id = ucd.user_id
       WHERE ucd.user_id = $1`,
      [peerId]
    );
    if (contact.rows.length > 0) {
      view.fullName = contact.rows[0].display_name ?? undefined;
      view.contactPhone = contact.rows[0].contact_phone ?? undefined;
      view.vehicleDescription = contact.rows[0].vehicle_description ?? undefined;
    }
  }

  return view;
}

export async function offerDisclosure(
  client: PoolClient,
  params: {
    conversationId: string;
    userId: string;
    level: DisclosureLevel;
    purpose: string;
  }
): Promise<
  | { effectiveLevel: DisclosureLevel; peerOffer: DisclosureLevel; ownOffer: DisclosureLevel }
  | { error: string }
> {
  if (params.level < 0 || params.level > 3) {
    return { error: "Invalid disclosure level" };
  }
  if (params.level === 3 && params.purpose !== "carpool") {
    return { error: "Level 3 disclosure is only allowed for carpool" };
  }

  const member = await client.query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [params.conversationId, params.userId]
  );
  if (member.rows.length === 0) {
    return { error: "Conversation not found" };
  }

  const peerId = await getPeerId(client, params.conversationId, params.userId);
  if (!peerId) return { error: "Conversation not found" };

  const currentOffer = await getOfferedLevel(
    client,
    params.conversationId,
    params.userId
  );
  if (params.level < currentOffer) {
    return { error: "Disclosure level cannot be lowered" };
  }

  if (params.level >= 2) {
    const contact = await client.query(
      `SELECT first_name, block_or_flat FROM user_contact_details WHERE user_id = $1`,
      [params.userId]
    );
    if (
      contact.rows.length === 0 ||
      !contact.rows[0].first_name ||
      !contact.rows[0].block_or_flat
    ) {
      return {
        error: "Add your first name and flat number before sharing identity",
      };
    }
  }

  if (params.level === 3) {
    const contact = await client.query(
      `SELECT contact_phone, vehicle_description FROM user_contact_details WHERE user_id = $1`,
      [params.userId]
    );
    if (
      contact.rows.length === 0 ||
      !contact.rows[0].contact_phone ||
      !contact.rows[0].vehicle_description
    ) {
      return {
        error: "Add phone and vehicle details before full disclosure",
      };
    }
  }

  const previousEffective = Math.min(
    currentOffer,
    await getOfferedLevel(client, params.conversationId, peerId)
  ) as DisclosureLevel;

  await client.query(
    `INSERT INTO conversation_disclosures (conversation_id, user_id, offered_level, purpose)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET
       offered_level = GREATEST(conversation_disclosures.offered_level, EXCLUDED.offered_level),
       purpose = EXCLUDED.purpose,
       offered_at = now()`,
    [params.conversationId, params.userId, params.level, params.purpose]
  );

  const ownOffer = await getOfferedLevel(
    client,
    params.conversationId,
    params.userId
  );
  const peerOffer = await getOfferedLevel(
    client,
    params.conversationId,
    peerId
  );
  const effectiveLevel = Math.min(ownOffer, peerOffer) as DisclosureLevel;

  await client.query(
    `INSERT INTO disclosure_events
       (conversation_id, actor_id, from_level, to_level, purpose, effective_level_after)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.conversationId,
      params.userId,
      currentOffer,
      ownOffer,
      params.purpose,
      effectiveLevel,
    ]
  );

  const peerUser = await client.query(
    "SELECT push_token, notification_prefs FROM users WHERE id = $1",
    [peerId]
  );

  if (peerUser.rows.length > 0) {
    if (effectiveLevel > previousEffective && effectiveLevel === ownOffer && effectiveLevel === peerOffer) {
      await createNotification(client, {
        userId: params.userId,
        type: "disclosure_accepted",
        title: "Identity shared",
        body: "You can now see each other's contact details in this chat",
        data: { conversationId: params.conversationId },
        pushToken: (
          await client.query(
            "SELECT push_token, notification_prefs FROM users WHERE id = $1",
            [params.userId]
          )
        ).rows[0]?.push_token,
        notificationPrefs: (
          await client.query(
            "SELECT notification_prefs FROM users WHERE id = $1",
            [params.userId]
          )
        ).rows[0]?.notification_prefs,
      });
      await createNotification(client, {
        userId: peerId,
        type: "disclosure_accepted",
        title: "Identity shared",
        body: "You can now see each other's contact details in this chat",
        data: { conversationId: params.conversationId },
        pushToken: peerUser.rows[0].push_token,
        notificationPrefs: peerUser.rows[0].notification_prefs,
      });
    } else if (ownOffer > peerOffer) {
      await createNotification(client, {
        userId: peerId,
        type: "disclosure_request",
        title: "A parent wants to share identity",
        body: "Open the chat to accept sharing your first name and flat",
        data: { conversationId: params.conversationId, level: ownOffer },
        pushToken: peerUser.rows[0].push_token,
        notificationPrefs: peerUser.rows[0].notification_prefs,
      });
    }
  }

  return { effectiveLevel, peerOffer, ownOffer };
}
