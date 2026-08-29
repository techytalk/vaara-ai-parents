import type { PoolClient } from "pg";
import { sendExpoPushBatch } from "../lib/expo-push.js";
import {
  isPrefEnabled,
  PREF_KEY_BY_NOTIFICATION_TYPE,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "../lib/notification-prefs.js";
import { isInQuietHours, nextAllowedPushTime } from "../lib/quiet-hours.js";

type NotificationType =
  | "circle_post"
  | "circle_reply"
  | "direct_message"
  | "activity_nearby"
  | "reminder"
  | "provider_update"
  | "topic_digest"
  | "listing_interest"
  | "disclosure_request"
  | "disclosure_accepted"
  | "carpool_update"
  | "expert_session"
  | "school_event"
  | "playdate_interest";

export type NotificationDelivery = "immediate" | "digest";

const DIGEST_NOTIFICATION_TYPES = new Set<NotificationType>([
  "circle_post",
  "topic_digest",
  "school_event",
  "activity_nearby",
  "listing_interest",
]);

const DIGEST_MIN_AGE_MS = Number(
  process.env.NOTIFICATION_DIGEST_MIN_AGE_MS ?? 30 * 60 * 1000
);

const CIRCLE_TYPE_RANK: Record<string, number> = {
  school_class: 6,
  class: 5,
  school: 4,
  community: 3,
  locality: 2,
  curriculum: 1,
};

type CircleTarget = {
  id: string;
  circle_type: string;
  display_name: string;
};

type NotificationInsert = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  pushToken?: string | null;
  notificationPrefs?: NotificationPrefs | null;
};

function defaultDelivery(type: NotificationType): NotificationDelivery {
  return DIGEST_NOTIFICATION_TYPES.has(type) ? "digest" : "immediate";
}

function prefKeyForType(
  type: NotificationType,
  explicit?: NotificationPrefKey
): NotificationPrefKey | undefined {
  return explicit ?? PREF_KEY_BY_NOTIFICATION_TYPE[type];
}

export async function batchCreateNotifications(
  client: PoolClient,
  type: NotificationType,
  items: NotificationInsert[],
  options?: {
    delivery?: NotificationDelivery;
    prefKey?: NotificationPrefKey;
  }
): Promise<string[]> {
  const delivery = options?.delivery ?? defaultDelivery(type);
  const prefKey = prefKeyForType(type, options?.prefKey);

  const eligible = items.filter((item) => {
    if (!prefKey) return true;
    return isPrefEnabled(item.notificationPrefs, prefKey);
  });
  if (eligible.length === 0) return [];

  const userIds = eligible.map((item) => item.userId);
  const types = eligible.map(() => type);
  const titles = eligible.map((item) => item.title);
  const bodies = eligible.map((item) => item.body);
  const dataJson = eligible.map((item) =>
    JSON.stringify({ ...item.data, type })
  );

  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     SELECT user_id, notification_type::notification_type, title, body, data
     FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::jsonb[])
       AS input(user_id, notification_type, title, body, data)
     RETURNING id, user_id`,
    [userIds, types, titles, bodies, dataJson]
  );

  const notificationIds = rows.map((row) => row.id as string);

  if (delivery === "immediate") {
    const outboxItems: Array<{
      notificationId: string;
      pushToken: string;
      payload: { title: string; body: string; data: Record<string, unknown> };
      notificationPrefs?: NotificationPrefs | null;
    }> = [];

    for (let i = 0; i < eligible.length; i++) {
      const item = eligible[i];
      if (!item.pushToken) continue;
      outboxItems.push({
        notificationId: notificationIds[i],
        pushToken: item.pushToken,
        payload: {
          title: item.title,
          body: item.body,
          data: {
            ...item.data,
            notificationId: notificationIds[i],
            type,
          },
        },
        notificationPrefs: item.notificationPrefs,
      });
    }

    if (outboxItems.length > 0) {
      await client.query(
        `INSERT INTO notification_outbox (notification_id, push_token, payload, send_after)
         SELECT notification_id, push_token, payload, send_after
         FROM unnest($1::uuid[], $2::text[], $3::jsonb[], $4::timestamptz[])
           AS input(notification_id, push_token, payload, send_after)`,
        [
          outboxItems.map((item) => item.notificationId),
          outboxItems.map((item) => item.pushToken),
          outboxItems.map((item) => JSON.stringify(item.payload)),
          outboxItems.map((item) =>
            nextAllowedPushTime(item.notificationPrefs ?? undefined).toISOString()
          ),
        ]
      );

      await client.query(
        `UPDATE notifications
         SET push_sent_at = now()
         WHERE id = ANY($1::uuid[])`,
        [outboxItems.map((item) => item.notificationId)]
      );
    }
  }

  return notificationIds;
}

export async function createNotification(
  client: PoolClient,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    pushToken?: string | null;
    notificationPrefs?: NotificationPrefs | null;
    prefKey?: NotificationPrefKey;
    delivery?: NotificationDelivery;
    sendPush?: boolean;
  }
): Promise<string | null> {
  const prefKey = prefKeyForType(params.type, params.prefKey);
  if (prefKey && !isPrefEnabled(params.notificationPrefs, prefKey)) {
    return null;
  }

  const delivery = params.delivery ?? defaultDelivery(params.type);
  const body = params.body ?? "";
  const shouldPush =
    params.sendPush !== false && delivery === "immediate" && params.pushToken;

  const [notificationId] = await batchCreateNotifications(
    client,
    params.type,
    [
      {
        userId: params.userId,
        title: params.title,
        body,
        data: params.data ?? {},
        pushToken: shouldPush ? params.pushToken : null,
        notificationPrefs: params.notificationPrefs,
      },
    ],
    {
      delivery: shouldPush ? "immediate" : delivery,
      prefKey,
    }
  );

  return notificationId ?? null;
}

function pickBestCircleForMember(
  targets: CircleTarget[],
  memberCircleTypes: Set<string>
): CircleTarget {
  const matching = targets.filter((t) => memberCircleTypes.has(t.circle_type));
  const pool = matching.length > 0 ? matching : targets;
  return pool.reduce((best, current) =>
    (CIRCLE_TYPE_RANK[current.circle_type] ?? 0) >
    (CIRCLE_TYPE_RANK[best.circle_type] ?? 0)
      ? current
      : best
  );
}

export async function notifyCirclePostMulti(
  client: PoolClient,
  params: {
    targets: CircleTarget[];
    postId: string;
    authorId: string;
    postPreview: string;
  }
) {
  if (params.targets.length === 0) return;

  const circleIds = params.targets.map((t) => t.id);
  const preview =
    params.postPreview.length > 80
      ? `${params.postPreview.slice(0, 80)}…`
      : params.postPreview;

  const { rows: recipients } = await client.query(
    `SELECT DISTINCT u.id, u.push_token, u.notification_prefs,
            array_agg(DISTINCT c.circle_type) AS circle_types
     FROM circle_members cm
     JOIN users u ON u.id = cm.user_id
     JOIN circles c ON c.id = cm.circle_id
     WHERE cm.circle_id = ANY($1::uuid[])
       AND cm.user_id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes nm
         WHERE nm.user_id = u.id
           AND nm.scope = 'circle'
           AND nm.scope_id = cm.circle_id
       )
     GROUP BY u.id, u.push_token, u.notification_prefs`,
    [circleIds, params.authorId]
  );

  const items: NotificationInsert[] = recipients.map((recipient) => {
    const memberTypes = new Set<string>(
      (recipient.circle_types as string[]) ?? []
    );
    const bestCircle = pickBestCircleForMember(params.targets, memberTypes);

    return {
      userId: recipient.id,
      title: `New post in ${bestCircle.display_name}`,
      body: preview,
      data: {
        circleId: bestCircle.id,
        postId: params.postId,
      },
      pushToken: recipient.push_token,
      notificationPrefs: recipient.notification_prefs,
    };
  });

  await batchCreateNotifications(client, "circle_post", items, {
    delivery: "digest",
    prefKey: "circle_posts",
  });
}

export async function notifyCircleReply(
  client: PoolClient,
  params: {
    postAuthorId: string;
    postId: string;
    circleId: string;
    circleName: string;
    replierId: string;
    replyPreview: string;
  }
) {
  if (params.postAuthorId === params.replierId) return;

  const { rows } = await client.query(
    `SELECT push_token, notification_prefs FROM users WHERE id = $1`,
    [params.postAuthorId]
  );
  if (rows.length === 0) return;

  const user = rows[0];
  const preview =
    params.replyPreview.length > 80
      ? `${params.replyPreview.slice(0, 80)}…`
      : params.replyPreview;

  await createNotification(client, {
    userId: params.postAuthorId,
    type: "circle_reply",
    title: `Reply in ${params.circleName}`,
    body: preview,
    data: {
      circleId: params.circleId,
      postId: params.postId,
    },
    pushToken: user.push_token,
    notificationPrefs: user.notification_prefs,
    prefKey: "circle_replies",
    delivery: "immediate",
  });
}

export async function notifyDirectMessage(
  client: PoolClient,
  params: {
    recipientId: string;
    senderHandle: string;
    conversationId: string;
    messagePreview: string;
  }
) {
  const { rows } = await client.query(
    `SELECT push_token, notification_prefs FROM users WHERE id = $1`,
    [params.recipientId]
  );
  if (rows.length === 0) return;

  const user = rows[0];
  const preview =
    params.messagePreview.length > 100
      ? `${params.messagePreview.slice(0, 100)}…`
      : params.messagePreview;

  await createNotification(client, {
    userId: params.recipientId,
    type: "direct_message",
    title: `Message from ${params.senderHandle}`,
    body: preview,
    data: { conversationId: params.conversationId },
    pushToken: user.push_token,
    notificationPrefs: user.notification_prefs,
    prefKey: "direct_messages",
    delivery: "immediate",
  });
}

export async function processNotificationOutbox(
  client: PoolClient
): Promise<number> {
  const { rows } = await client.query(
    `SELECT o.id, o.push_token, o.payload, o.attempts, u.notification_prefs
     FROM notification_outbox o
     JOIN notifications n ON n.id = o.notification_id
     JOIN users u ON u.id = n.user_id
     WHERE o.delivered_at IS NULL
       AND o.attempts < 5
       AND o.send_after <= now()
     ORDER BY o.created_at
     LIMIT 100`
  );

  if (rows.length === 0) return 0;

  const deliverable = rows.filter(
    (row) => !isInQuietHours(row.notification_prefs)
  );

  const deferred = rows.filter((row) =>
    isInQuietHours(row.notification_prefs)
  );

  for (const row of deferred) {
    const sendAfter = nextAllowedPushTime(row.notification_prefs);
    await client.query(
      `UPDATE notification_outbox
       SET send_after = GREATEST(send_after, $2)
       WHERE id = $1`,
      [row.id, sendAfter.toISOString()]
    );
  }

  if (deliverable.length === 0) return 0;

  const results = await sendExpoPushBatch(
    deliverable.map((row) => ({
      pushToken: row.push_token,
      payload: row.payload as {
        title: string;
        body: string;
        data: Record<string, unknown>;
      },
    }))
  );

  let delivered = 0;
  for (let i = 0; i < deliverable.length; i++) {
    const row = deliverable[i];
    const result = results[i];
    if (result.ok) {
      await client.query(
        `UPDATE notification_outbox
         SET delivered_at = now(), last_error = NULL
         WHERE id = $1`,
        [row.id]
      );
      delivered++;
    } else {
      await client.query(
        `UPDATE notification_outbox
         SET attempts = attempts + 1, last_error = $2
         WHERE id = $1`,
        [row.id, result.error ?? "Push failed"]
      );
    }
  }

  return delivered;
}

export async function processNotificationDigests(
  client: PoolClient
): Promise<number> {
  const minAge = new Date(Date.now() - DIGEST_MIN_AGE_MS).toISOString();
  const digestTypes = [...DIGEST_NOTIFICATION_TYPES];

  const { rows } = await client.query(
    `SELECT n.id, n.user_id, n.type, n.title, n.body,
            u.push_token, u.notification_prefs
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.push_sent_at IS NULL
       AND n.type::text = ANY($1::text[])
       AND n.created_at <= $2
     ORDER BY n.user_id, n.created_at`,
    [digestTypes, minAge]
  );

  if (rows.length === 0) return 0;

  const byUser = new Map<
    string,
    {
      pushToken: string | null;
      notificationPrefs: NotificationPrefs;
      notifications: typeof rows;
    }
  >();

  for (const row of rows) {
    const prefKey = PREF_KEY_BY_NOTIFICATION_TYPE[row.type as NotificationType];
    if (prefKey && !isPrefEnabled(row.notification_prefs, prefKey)) {
      continue;
    }

    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.notifications.push(row);
    } else {
      byUser.set(row.user_id, {
        pushToken: row.push_token,
        notificationPrefs: row.notification_prefs,
        notifications: [row],
      });
    }
  }

  let digestsSent = 0;

  for (const [userId, group] of byUser) {
    const ids = group.notifications.map((row) => row.id);
    const count = group.notifications.length;
    const latest = group.notifications[group.notifications.length - 1];

    if (!group.pushToken) {
      await client.query(
        `UPDATE notifications SET push_sent_at = now() WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      continue;
    }

    if (isInQuietHours(group.notificationPrefs)) {
      continue;
    }

    const title =
      count === 1 ? latest.title : `${count} updates in Vaara`;
    const body =
      count === 1
        ? latest.body ?? "Open Vaara to read more"
        : "New posts and activity since you last checked";

    const sendAfter = nextAllowedPushTime(group.notificationPrefs);
    await client.query(
      `INSERT INTO notification_outbox (notification_id, push_token, payload, send_after)
       VALUES ($1, $2, $3, $4)`,
      [
        latest.id,
        group.pushToken,
        JSON.stringify({
          title,
          body,
          data: {
            type: "digest",
            notificationIds: ids,
            userId,
          },
        }),
        sendAfter.toISOString(),
      ]
    );

    await client.query(
      `UPDATE notifications SET push_sent_at = now() WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    digestsSent++;
  }

  const skippedIds = rows
    .filter((row) => {
      const prefKey = PREF_KEY_BY_NOTIFICATION_TYPE[row.type as NotificationType];
      return prefKey && !isPrefEnabled(row.notification_prefs, prefKey);
    })
    .map((row) => row.id);

  if (skippedIds.length > 0) {
    await client.query(
      `UPDATE notifications SET push_sent_at = now() WHERE id = ANY($1::uuid[])`,
      [skippedIds]
    );
  }

  return digestsSent;
}

export async function processPendingReminders(client: PoolClient): Promise<number> {
  const { rows } = await client.query(
    `SELECT r.id, r.user_id, r.title, r.note, r.activity_id,
            u.push_token, u.notification_prefs
     FROM reminders r
     JOIN users u ON u.id = r.user_id
     WHERE r.sent = false AND r.fire_at <= now()
     ORDER BY r.fire_at
     LIMIT 100`
  );

  let sent = 0;
  for (const reminder of rows) {
    if (!isPrefEnabled(reminder.notification_prefs, "reminders")) {
      await client.query(
        "UPDATE reminders SET sent = true WHERE id = $1",
        [reminder.id]
      );
      continue;
    }

    await createNotification(client, {
      userId: reminder.user_id,
      type: "reminder",
      title: reminder.title,
      body: reminder.note ?? "Your reminder",
      data: {
        reminderId: reminder.id,
        activityId: reminder.activity_id,
      },
      pushToken: reminder.push_token,
      notificationPrefs: reminder.notification_prefs,
      prefKey: "reminders",
      delivery: "immediate",
    });

    await client.query("UPDATE reminders SET sent = true WHERE id = $1", [
      reminder.id,
    ]);
    sent++;
  }

  return sent;
}

async function processExpiredListings(client: PoolClient): Promise<number> {
  const { rows } = await client.query(
    `UPDATE listings
     SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND expires_at <= now()
     RETURNING id, seller_id, title`
  );

  for (const row of rows) {
    const seller = await client.query(
      "SELECT push_token, notification_prefs FROM users WHERE id = $1",
      [row.seller_id]
    );
    if (seller.rows.length > 0) {
      await createNotification(client, {
        userId: row.seller_id,
        type: "listing_interest",
        title: "Listing expired",
        body: `"${row.title}" — still available? Repost in one tap.`,
        data: { listingId: row.id },
        pushToken: seller.rows[0].push_token,
        notificationPrefs: seller.rows[0].notification_prefs,
        prefKey: "listings",
        delivery: "digest",
      });
    }
  }

  return rows.length;
}

export async function notifyCommunityNewListing(
  client: PoolClient,
  params: {
    listingId: string;
    sellerId: string;
    title: string;
    communityKey: string | null;
  }
) {
  if (!params.communityKey) return;

  const { rows } = await client.query(
    `SELECT DISTINCT u.id, u.push_token, u.notification_prefs
     FROM user_locations ul
     JOIN users u ON u.id = ul.user_id
     WHERE ul.community_key = $1
       AND ul.user_id <> $2`,
    [params.communityKey, params.sellerId]
  );

  await batchCreateNotifications(
    client,
    "listing_interest",
    rows.map((row) => ({
      userId: row.id,
      title: "New listing in your community",
      body: params.title,
      data: { listingId: params.listingId },
      pushToken: row.push_token,
      notificationPrefs: row.notification_prefs,
    })),
    { delivery: "digest", prefKey: "listings" }
  );
}

export async function processBackgroundJobs(client: PoolClient): Promise<{
  remindersSent: number;
  pushesDelivered: number;
  digestsSent: number;
  listingsExpired: number;
}> {
  const remindersSent = await processPendingReminders(client);
  const digestsSent = await processNotificationDigests(client);
  const pushesDelivered = await processNotificationOutbox(client);
  const listingsExpired = await processExpiredListings(client);
  return { remindersSent, pushesDelivered, digestsSent, listingsExpired };
}
