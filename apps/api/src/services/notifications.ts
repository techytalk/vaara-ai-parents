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
  | "provider_update";

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
    await sendExpoPush(params.pushToken, {
      title: params.title,
      body: params.body ?? "",
      data: { ...params.data, notificationId, type: params.type },
    });
  }

  return notificationId;
}

export async function notifyCirclePost(
  client: PoolClient,
  params: {
    circleId: string;
    circleName: string;
    postId: string;
    authorId: string;
    postPreview: string;
  }
) {
  const { rows: members } = await client.query(
    `SELECT u.id, u.push_token, u.notification_prefs
     FROM circle_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.circle_id = $1 AND cm.user_id != $2`,
    [params.circleId, params.authorId]
  );

  const preview =
    params.postPreview.length > 80
      ? `${params.postPreview.slice(0, 80)}…`
      : params.postPreview;

  for (const member of members) {
    if (!isPrefEnabled(member.notification_prefs, "circle_posts")) continue;

    const recent = await client.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND type = 'circle_post'
         AND data->>'circleId' = $2
         AND created_at > now() - interval '1 hour'
       LIMIT 1`,
      [member.id, params.circleId]
    );
    if (recent.rows.length > 0) continue;

    await createNotification(client, {
      userId: member.id,
      type: "circle_post",
      title: `New post in ${params.circleName}`,
      body: preview,
      data: {
        circleId: params.circleId,
        postId: params.postId,
      },
      pushToken: member.push_token,
      notificationPrefs: member.notification_prefs,
      prefKey: "circle_posts",
    });
  }
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
