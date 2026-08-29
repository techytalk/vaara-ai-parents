import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar, ScreenLoader, SectionHeader } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/features";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  api,
  type AuthUser,
  type Child,
  type NotificationPrefs,
} from "@/lib/api";
import { getToken } from "@/lib/session";

type BooleanPrefKey = Exclude<keyof NotificationPrefs, "quiet_hours">;

const PREF_LABELS: Record<BooleanPrefKey, string> = {
  circle_posts: "Circle posts",
  circle_replies: "Replies to your posts",
  direct_messages: "Direct messages",
  reminders: "Reminders",
  activity_nearby: "Nearby activities",
  topics: "Topic digests",
  listings: "Marketplace",
  disclosures: "Identity sharing",
  carpool: "Carpool updates",
  school_events: "School calendar",
  expert_sessions: "Expert sessions",
};

type MenuIcon = keyof typeof Ionicons.glyphMap;

function MenuRow({
  icon,
  label,
  onPress,
  color = colors.primary,
}: {
  icon: MenuIcon;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.menuRowPressed,
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [circleCount, setCircleCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const [me, kids, circles, saved, notificationPrefs] = await Promise.all([
          api.me(token),
          api.getChildren(token).catch(() => []),
          api.getCircles(token).catch(() => []),
          api.getSaved(token).catch(() => ({ posts: [] })),
          api.getNotificationPrefs(token),
        ]);
        setUser(me);
        setChildren(kids);
        setCircleCount(circles.length);
        setSavedCount(saved.posts.length);
        setPrefs(notificationPrefs);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function togglePref(key: BooleanPrefKey, value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(prefs);
    }
  }

  async function toggleQuietHours(value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const updated = {
      ...prefs,
      quiet_hours: { ...prefs.quiet_hours, enabled: value },
    };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(prefs);
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading your account" />;
  }

  const childSummary =
    children.length > 0
      ? `${children[0].curriculum.code} · ${children[0].grade.label}`
      : "Complete your profile";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <Avatar handle={user?.anonymousHandle ?? "Parent"} size={72} />
        <Text style={styles.handle}>{user?.anonymousHandle ?? "Parent"}</Text>
        <Text style={styles.childSummary}>{childSummary}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatItem value={circleCount} label="Circles" />
        <View style={styles.statDivider} />
        <StatItem value={savedCount} label="Saved" />
        <View style={styles.statDivider} />
        <StatItem value="—" label="Upvotes" />
      </View>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="people-outline"
          label="My Children"
          onPress={() => router.push("/onboarding/children")}
        />
        <MenuRow
          icon="people-circle-outline"
          label="My Circles"
          onPress={() => router.push("/(app)/circles" as never)}
        />
        <MenuRow
          icon="bookmark-outline"
          label="Saved Posts"
          onPress={() => router.push("/(app)/saved")}
        />
        <MenuRow
          icon="storefront-outline"
          label="My Listings"
          color={colors.coral}
          onPress={() => router.push("/(app)/market")}
        />
        <MenuRow
          icon="chatbubbles-outline"
          label="Messages"
          onPress={() => router.push("/(app)/messages")}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push("/(app)/notifications")}
        />
        <MenuRow
          icon="settings-outline"
          label="Settings & Privacy"
          onPress={() => setShowSettings((current) => !current)}
        />
        <MenuRow
          icon="help-circle-outline"
          label="Help & Support"
          color={colors.amber}
          onPress={() =>
            Alert.alert(
              "Help & Support",
              "Email support@vaara.ai for help with your account, privacy, or community safety."
            )
          }
        />
      </View>

      {showSettings ? (
        <>
          <SectionHeader title="Family & privacy" />
          <View style={styles.menuGroup}>
            <MenuRow
              icon="location-outline"
              label="Location & community"
              onPress={() => router.push("/onboarding/location")}
            />
            <MenuRow
              icon="id-card-outline"
              label="Contact details for handover"
              onPress={() => router.push("/(app)/contact-details")}
            />
            <MenuRow
              icon="pricetags-outline"
              label="Interest topics"
              color={colors.lavender}
              onPress={() => router.push("/(app)/topics")}
            />
            <MenuRow
              icon="calendar-outline"
              label="School calendar"
              onPress={() => router.push("/(app)/calendar")}
            />
            {FEATURE_FLAGS.showPlaydates ? (
              <MenuRow
                icon="happy-outline"
                label="Playdates"
                onPress={() => router.push("/(app)/playdates")}
              />
            ) : null}
          </View>

          <SectionHeader title="Notification preferences" />
          <Text style={styles.sectionHint}>
            Circle and topic activity arrives as a digest. Replies and messages
            are immediate.
          </Text>
          {prefs ? (
            <View style={styles.menuGroup}>
              {(Object.keys(PREF_LABELS) as BooleanPrefKey[]).map((key) => (
                <View key={key} style={styles.prefRow}>
                  <Text style={styles.prefLabel}>{PREF_LABELS[key]}</Text>
                  <Switch
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
            </View>
          ) : null}
        </>
      ) : null}

      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.navy,
    marginBottom: spacing.md,
  },
  handle: {
    ...typography.sectionTitle,
    color: colors.textInverse,
    fontFamily: typography.bold,
    marginTop: spacing.sm,
  },
  childSummary: {
    ...typography.supporting,
    color: colors.primaryLight,
    fontFamily: typography.medium,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  menuGroup: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  menuRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowPressed: { backgroundColor: colors.surfaceMuted },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    flex: 1,
  },
  sectionHint: {
    ...typography.supporting,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontFamily: typography.regular,
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
});
