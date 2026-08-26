import type { PoolClient } from "pg";
import { sendExpoPush } from "../lib/expo-push.js";
import {
  isPrefEnabled,
  type NotificationPrefs,
} from "../lib/notification-prefs.js";

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

async function enqueuePush(
  client: PoolClient,
  notificationId: string,
  pushToken: string,
  payload: { title: string; body: string; data: Record<string, unknown> }
) {
  await client.query(
    `INSERT INTO notification_outbox (notification_id, push_token, payload)
     VALUES ($1, $2, $3)`,
    [notificationId, pushToken, JSON.stringify(payload)]
  );
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
    prefKey?: keyof NotificationPrefs;
    sendPush?: boolean;
  }
): Promise<string | null> {
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      params.userId,
      params.type,
      params.title,
      params.body ?? null,
      JSON.stringify(params.data ?? {}),
    ]
  );

  const notificationId = rows[0].id as string;

  const shouldPush =
    params.sendPush !== false &&
    params.pushToken &&
    (params.prefKey
      ? isPrefEnabled(params.notificationPrefs, params.prefKey)
      : true);

  if (shouldPush && params.pushToken) {
    await enqueuePush(client, notificationId, params.pushToken, {
      title: params.title,
      body: params.body ?? "",
      data: { ...params.data, notificationId, type: params.type },
    });
  }

  return notificationId;
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

  for (const recipient of recipients) {
    if (!isPrefEnabled(recipient.notification_prefs, "circle_posts")) continue;

    const memberTypes = new Set<string>(
      (recipient.circle_types as string[]) ?? []
    );
    const bestCircle = pickBestCircleForMember(params.targets, memberTypes);

    await createNotification(client, {
      userId: recipient.id,
      type: "circle_post",
      title: `New post in ${bestCircle.display_name}`,
      body: preview,
      data: {
        circleId: bestCircle.id,
        postId: params.postId,
      },
      pushToken: recipient.push_token,
      notificationPrefs: recipient.notification_prefs,
      prefKey: "circle_posts",
    });
  }
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
  });
}

export async function processNotificationOutbox(
  client: PoolClient
): Promise<number> {
  const { rows } = await client.query(
    `SELECT id, push_token, payload, attempts
     FROM notification_outbox
     WHERE delivered_at IS NULL AND attempts < 5
     ORDER BY created_at
     LIMIT 50`
  );

  let delivered = 0;
  for (const row of rows) {
    const payload = row.payload as {
      title: string;
      body: string;
      data: Record<string, unknown>;
    };
    try {
      await sendExpoPush(row.push_token, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
      await client.query(
        `UPDATE notification_outbox
         SET delivered_at = now(), last_error = NULL
         WHERE id = $1`,
        [row.id]
      );
      delivered++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Push failed";
      await client.query(
        `UPDATE notification_outbox
         SET attempts = attempts + 1, last_error = $2
         WHERE id = $1`,
        [row.id, message]
      );
    }
  }
  return delivered;
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
      });
    }
  }

  return rows.length;
}

export async function processBackgroundJobs(client: PoolClient): Promise<{
  remindersSent: number;
  pushesDelivered: number;
  listingsExpired: number;
}> {
  const remindersSent = await processPendingReminders(client);
  const pushesDelivered = await processNotificationOutbox(client);
  const listingsExpired = await processExpiredListings(client);
  return { remindersSent, pushesDelivered, listingsExpired };
}
