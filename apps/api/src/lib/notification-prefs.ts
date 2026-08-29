export type QuietHoursPrefs = {
  enabled?: boolean;
  start?: string;
  end?: string;
  timezone?: string;
};

export type NotificationPrefs = {
  circle_posts?: boolean;
  circle_replies?: boolean;
  direct_messages?: boolean;
  reminders?: boolean;
  activity_nearby?: boolean;
  topics?: boolean;
  listings?: boolean;
  disclosures?: boolean;
  carpool?: boolean;
  school_events?: boolean;
  expert_sessions?: boolean;
  quiet_hours?: QuietHoursPrefs;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  circle_posts: true,
  circle_replies: true,
  direct_messages: true,
  reminders: true,
  activity_nearby: true,
  topics: true,
  listings: true,
  disclosures: true,
  carpool: true,
  school_events: true,
  expert_sessions: true,
  quiet_hours: {
    enabled: true,
    start: "22:00",
    end: "07:00",
    timezone: "Asia/Kolkata",
  },
};

export const NOTIFICATION_PREF_KEYS = [
  "circle_posts",
  "circle_replies",
  "direct_messages",
  "reminders",
  "activity_nearby",
  "topics",
  "listings",
  "disclosures",
  "carpool",
  "school_events",
  "expert_sessions",
] as const satisfies readonly (keyof NotificationPrefs)[];

export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

export const PREF_KEY_BY_NOTIFICATION_TYPE: Partial<
  Record<string, NotificationPrefKey>
> = {
  circle_post: "circle_posts",
  circle_reply: "circle_replies",
  direct_message: "direct_messages",
  connection_request: "direct_messages",
  reminder: "reminders",
  activity_nearby: "activity_nearby",
  topic_digest: "topics",
  listing_interest: "listings",
  disclosure_request: "disclosures",
  disclosure_accepted: "disclosures",
  carpool_update: "carpool",
  school_event: "school_events",
  expert_session: "expert_sessions",
};

export function mergeNotificationPrefs(
  prefs: NotificationPrefs | null | undefined
): NotificationPrefs {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...prefs,
    quiet_hours: {
      ...DEFAULT_NOTIFICATION_PREFS.quiet_hours,
      ...prefs?.quiet_hours,
    },
  };
}

export function isPrefEnabled(
  prefs: NotificationPrefs | null | undefined,
  key: NotificationPrefKey
): boolean {
  const merged = mergeNotificationPrefs(prefs);
  return merged[key] !== false;
}
