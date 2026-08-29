import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { TimeField } from "@/components/DateTimeField";
import { InlineError, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type NotificationPrefs } from "@/lib/api";
import { getToken } from "@/lib/session";

type BooleanPrefKey = Exclude<keyof NotificationPrefs, "quiet_hours">;

const PREF_LABELS: Record<BooleanPrefKey, string> = {
  circle_posts: "Circle posts",
  circle_replies: "Replies to your posts",
  direct_messages: "Direct messages and parent connection requests",
  reminders: "Reminders",
  activity_nearby: "Nearby activities",
  topics: "Topic digests",
  listings: "Marketplace",
  disclosures: "Identity sharing",
  carpool: "Carpool updates",
  school_events: "School calendar",
  expert_sessions: "Expert sessions",
};

const IMMEDIATE_PREFS = new Set<BooleanPrefKey>([
  "circle_replies",
  "direct_messages",
  "disclosures",
  "reminders",
  "carpool",
  "school_events",
  "expert_sessions",
]);

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const notificationPrefs = await api.getNotificationPrefs(token);
    setPrefs(notificationPrefs);
    setLoadError(null);
  }, []);

  useEffect(() => {
    load()
      .catch(() => setLoadError("Could not load notification preferences."))
      .finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch {
      setLoadError("Could not load notification preferences.");
    } finally {
      setRefreshing(false);
    }
  }

  async function togglePref(key: BooleanPrefKey, value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const previous = prefs;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(previous);
      Alert.alert(
        "Could not save",
        "Your notification preference was not updated. Please try again."
      );
    }
  }

  async function toggleQuietHours(value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const previous = prefs;
    const updated = {
      ...prefs,
      quiet_hours: { ...prefs.quiet_hours, enabled: value },
    };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(previous);
      Alert.alert(
        "Could not save",
        "Quiet hours were not updated. Please try again."
      );
    }
  }

  async function updateQuietHoursTime(
    field: "start" | "end",
    value: string
  ) {
    const token = await getToken();
    if (!token || !prefs) return;
    const previous = prefs;
    const updated = {
      ...prefs,
      quiet_hours: { ...prefs.quiet_hours, [field]: value },
    };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(previous);
      Alert.alert(
        "Could not save",
        "Quiet hours were not updated. Please try again."
      );
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading notification preferences" />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {loadError ? (
        <InlineError message={loadError} onRetry={onRefresh} />
      ) : null}

      <Text style={styles.sectionHint}>
        Circle posts, topic digests, nearby activities, and marketplace updates
        arrive as digests. Replies, messages, connection requests, reminders,
        identity sharing, carpool, school calendar, and expert session alerts
        are immediate.
      </Text>

      {prefs ? (
        <View style={styles.menuGroup}>
          {(Object.keys(PREF_LABELS) as BooleanPrefKey[]).map((key) => (
            <View key={key} style={styles.prefRow}>
              <View style={styles.prefCopy}>
                <Text style={styles.prefLabel}>{PREF_LABELS[key]}</Text>
                <Text style={styles.prefHint}>
                  {IMMEDIATE_PREFS.has(key) ? "Immediate" : "Digest"}
                </Text>
              </View>
              <Switch
                accessibilityLabel={PREF_LABELS[key]}
                value={prefs[key] !== false}
                onValueChange={(value) => togglePref(key, value)}
                trackColor={{
                  false: colors.border,
                  true: colors.primaryLight,
                }}
                thumbColor={
                  prefs[key] !== false ? colors.primary : colors.card
                }
              />
            </View>
          ))}
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefLabel}>Quiet hours</Text>
              <Text style={styles.prefHint}>
                {prefs.quiet_hours?.start ?? "22:00"} –{" "}
                {prefs.quiet_hours?.end ?? "07:00"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Quiet hours"
              value={prefs.quiet_hours?.enabled !== false}
              onValueChange={toggleQuietHours}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={
                prefs.quiet_hours?.enabled !== false
                  ? colors.primary
                  : colors.card
              }
            />
          </View>
          {prefs.quiet_hours?.enabled !== false ? (
            <View style={styles.quietHoursFields}>
              <TimeField
                label="Start"
                value={prefs.quiet_hours?.start ?? "22:00"}
                onChange={(value) => updateQuietHoursTime("start", value)}
              />
              <TimeField
                label="End"
                value={prefs.quiet_hours?.end ?? "07:00"}
                onChange={(value) => updateQuietHoursTime("end", value)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionHint: {
    ...typography.supporting,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontFamily: typography.regular,
    lineHeight: 22,
  },
  menuGroup: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prefCopy: { flex: 1, paddingRight: spacing.sm },
  prefLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.medium,
  },
  prefHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.regular,
  },
  quietHoursFields: {
    padding: spacing.sm,
    paddingTop: 0,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
