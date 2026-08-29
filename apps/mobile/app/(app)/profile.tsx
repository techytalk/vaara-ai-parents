import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar, ScreenLoader } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/features";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type AuthUser, type Child, type MeStats } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";

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
  const [stats, setStats] = useState<MeStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const [me, kids, meStats] = await Promise.all([
          api.me(token),
          api.getChildren(token).catch(() => []),
          api.getMeStats(token).catch(() => null),
        ]);
        setUser(me);
        setChildren(kids);
        if (meStats) {
          setStats(meStats);
          setStatsFailed(false);
        } else {
          setStatsFailed(true);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return <ScreenLoader label="Loading your account" />;
  }

  const childSummary =
    children.length > 0
      ? `${children[0].curriculum.code} · ${children[0].grade.label}`
      : "Complete your profile";

  const circleValue = statsFailed ? "—" : (stats?.circleCount ?? 0);
  const savedValue = statsFailed ? "—" : (stats?.savedPostCount ?? 0);
  const helpfulValue = statsFailed ? "—" : (stats?.helpfulReceivedCount ?? 0);

  function openMore(destination: string, label: string) {
    trackEvent("more_destination_opened", { destination: label });
    router.push(destination as never);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change avatar"
          onPress={() => router.push("/(app)/settings/avatar" as never)}
        >
          <Avatar
            handle={user?.anonymousHandle ?? "Parent"}
            avatarKey={user?.avatarKey}
            size={72}
          />
        </Pressable>
        <Text style={styles.handle}>{user?.anonymousHandle ?? "Parent"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/settings/avatar" as never)}
        >
          <Text style={styles.changeAvatar}>Change avatar</Text>
        </Pressable>
        <Text style={styles.childSummary}>{childSummary}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatItem value={circleValue} label="Circles" />
        <View style={styles.statDivider} />
        <StatItem value={savedValue} label="Saved" />
        <View style={styles.statDivider} />
        <StatItem value={helpfulValue} label="Helpful received" />
      </View>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="people-outline"
          label="My Children"
          onPress={() => openMore("/onboarding/children", "children")}
        />
        <MenuRow
          icon="people-circle-outline"
          label="My Circles"
          onPress={() => openMore("/(app)/circles", "circles")}
        />
        <MenuRow
          icon="bookmark-outline"
          label="Saved Posts"
          onPress={() => openMore("/(app)/saved", "saved")}
        />
        <MenuRow
          icon="storefront-outline"
          label="My Listings"
          color={colors.coral}
          onPress={() => openMore("/(app)/market", "market")}
        />
        <MenuRow
          icon="chatbubbles-outline"
          label="Messages"
          onPress={() => openMore("/(app)/messages", "messages")}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => openMore("/(app)/notifications", "notifications")}
        />
        <MenuRow
          icon="settings-outline"
          label="Settings & Privacy"
          onPress={() => openMore("/(app)/settings", "settings")}
        />
        <MenuRow
          icon="options-outline"
          label="Notification Preferences"
          onPress={() =>
            openMore("/(app)/settings/notifications", "notification_preferences")
          }
        />
        <MenuRow
          icon="help-circle-outline"
          label="Help & Support"
          color={colors.amber}
          onPress={() => openMore("/(app)/support", "support")}
        />
      </View>

      {FEATURE_FLAGS.showDoctors ||
      FEATURE_FLAGS.showPlaydates ||
      FEATURE_FLAGS.showCarpool ? (
        <View style={styles.menuGroup}>
          {FEATURE_FLAGS.showDoctors ? (
            <MenuRow
              icon="medkit-outline"
              label="Local doctors"
              color={colors.teal}
              onPress={() =>
                openMore("/(app)/practitioners", "practitioners")
              }
            />
          ) : null}
          {FEATURE_FLAGS.showPlaydates ? (
            <MenuRow
              icon="happy-outline"
              label="Playdates"
              color={colors.lavender}
              onPress={() => openMore("/(app)/playdates", "playdates")}
            />
          ) : null}
          {FEATURE_FLAGS.showCarpool ? (
            <MenuRow
              icon="car-outline"
              label="Carpool"
              onPress={() => openMore("/(app)/carpool", "carpool")}
            />
          ) : null}
        </View>
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
  changeAvatar: {
    ...typography.caption,
    color: colors.primaryLight,
    fontFamily: typography.semibold,
    marginTop: 4,
    textDecorationLine: "underline",
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
    textAlign: "center",
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
});
