import { useEffect, useState } from "react";
import {
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
  detail,
  onPress,
  color = colors.primary,
}: {
  icon: MenuIcon;
  label: string;
  detail?: string;
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
      <View style={styles.menuCopy}>
        <Text style={styles.menuLabel}>{label}</Text>
        {detail ? <Text style={styles.menuDetail}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me(token);
        setUser(me);
        setPrefs(await api.getNotificationPrefs(token));
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
      quiet_hours: {
        ...prefs.quiet_hours,
        enabled: value,
      },
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.profileCard}>
        <Avatar handle={user?.anonymousHandle ?? "Parent"} size={64} />
        <View style={styles.profileCopy}>
          <Text style={styles.handle}>{user?.anonymousHandle ?? "Parent"}</Text>
          <Text style={styles.privateLabel}>
            <Ionicons name="shield-checkmark" size={13} /> Private parent profile
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <SectionHeader title="Community" />
      <View style={styles.menuGroup}>
        <MenuRow
          icon="chatbubbles-outline"
          label="Messages"
          detail="Private conversations with parents"
          onPress={() => router.push("/(app)/messages")}
        />
        <MenuRow
          icon="storefront-outline"
          label="Community Market"
          detail="Local hand-me-downs and listings"
          color={colors.coral}
          onPress={() => router.push("/(app)/market")}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push("/(app)/notifications")}
        />
        <MenuRow
          icon="bookmark-outline"
          label="Saved posts"
          onPress={() => router.push("/(app)/saved")}
        />
      </View>

      <SectionHeader title="Explore & organize" />
      <View style={styles.menuGroup}>
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
        <MenuRow
          icon="sparkles-outline"
          label="Expert Q&A"
          color={colors.amber}
          onPress={() => router.push("/(app)/experts")}
        />
        <MenuRow
          icon="alarm-outline"
          label="My reminders"
          onPress={() => router.push("/(app)/reminders")}
        />
        {FEATURE_FLAGS.showDoctors ? (
          <MenuRow
            icon="medkit-outline"
            label="Local practitioners"
            onPress={() => router.push("/(app)/practitioners")}
          />
        ) : null}
        {FEATURE_FLAGS.showPlaydates ? (
          <MenuRow
            icon="happy-outline"
            label="Playdates"
            onPress={() => router.push("/(app)/playdates")}
          />
        ) : null}
        {FEATURE_FLAGS.showCarpool ? (
          <MenuRow
            icon="car-outline"
            label="School carpool"
            onPress={() => router.push("/(app)/carpool")}
          />
        ) : null}
      </View>

      <SectionHeader title="Family & privacy" />
      <View style={styles.menuGroup}>
        <MenuRow
          icon="people-outline"
          label="Children & schools"
          onPress={() => router.push("/onboarding/children")}
        />
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
      </View>

      <SectionHeader title="Notification preferences" />
      <Text style={styles.sectionHint}>
        Circle and topic activity arrives as a digest. Replies and messages are immediate.
      </Text>

      {prefs && (
        <>
          {(Object.keys(PREF_LABELS) as BooleanPrefKey[]).map((key) => (
            <View key={key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{PREF_LABELS[key]}</Text>
              <Switch
                value={prefs[key] !== false}
                onValueChange={(value) => togglePref(key, value)}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={prefs[key] !== false ? colors.primary : colors.card}
              />
            </View>
          ))}
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefLabel}>Quiet hours</Text>
              <Text style={styles.prefHint}>
                {prefs.quiet_hours?.start ?? "22:00"} – {prefs.quiet_hours?.end ?? "07:00"}
              </Text>
            </View>
            <Switch
              value={prefs.quiet_hours?.enabled !== false}
              onValueChange={toggleQuietHours}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                prefs.quiet_hours?.enabled !== false
                  ? colors.primary
                  : colors.card
              }
            />
          </View>
        </>
      )}

      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.navy,
    marginBottom: spacing.lg,
  },
  profileCopy: { flex: 1 },
  handle: {
    ...typography.sectionTitle,
    color: colors.textInverse,
    fontFamily: typography.bold,
  },
  privateLabel: {
    ...typography.caption,
    color: colors.primaryLight,
    fontFamily: typography.semibold,
    marginTop: 3,
  },
  email: {
    ...typography.caption,
    color: "#C4CDD5",
    fontFamily: typography.regular,
    marginTop: 6,
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
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowPressed: { backgroundColor: colors.surfaceMuted },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1 },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  menuDetail: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 1,
  },
  sectionHint: {
    ...typography.supporting,
    color: colors.textMuted,
    marginBottom: 8,
    fontFamily: typography.regular,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefCopy: {
    flex: 1,
    paddingRight: 12,
  },
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
