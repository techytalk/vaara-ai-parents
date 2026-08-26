export type NotificationPrefs = {
  circle_posts?: boolean;
  direct_messages?: boolean;
  reminders?: boolean;
  activity_nearby?: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  circle_posts: true,
  direct_messages: true,
  reminders: true,
  activity_nearby: true,
};

export function mergeNotificationPrefs(
  prefs: NotificationPrefs | null | undefined
): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
}

export function isPrefEnabled(
  prefs: NotificationPrefs | null | undefined,
  key: keyof NotificationPrefs
): boolean {
  const merged = mergeNotificationPrefs(prefs);
  return merged[key] !== false;
}
