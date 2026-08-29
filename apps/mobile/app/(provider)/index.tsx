import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type AuthUser, type ProviderProfile } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ProviderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }
      try {
        const me = await api.me(token);
        if (!me.onboardingComplete) {
          router.replace("/onboarding/provider");
          return;
        }
        const [prof, activities] = await Promise.all([
          api.getProviderProfile(token),
          api.getProviderActivities(token),
        ]);
        setUser(me);
        setProfile(prof);
        setActivityCount(activities.length);
      } catch {
        router.replace("/(auth)/login");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <ScreenLoader label="Loading provider dashboard" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Provider dashboard</Text>
        <Text style={styles.title}>{profile?.orgName ?? "Your organization"}</Text>
        <Text style={styles.subtitle}>
          {profile?.providerType} · Serving{" "}
          {profile?.servicePinCodes?.join(", ") ?? "your area"}
        </Text>
      </View>

      <Card style={styles.statCard}>
        <View style={styles.statRow}>
          <View style={styles.statIcon}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.statCopy}>
            <Text style={styles.statValue}>{activityCount}</Text>
            <Text style={styles.statLabel}>Published activities</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Publish workshops, classes, and camps for parents in your service areas.
        </Text>
        <Button
          label="Create activity"
          onPress={() => router.push("/(provider)/activities/new")}
        />
      </Card>

      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(provider)/activities")}
      >
        <Text style={styles.linkText}>Manage activities</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>

      {user?.email ? (
        <Text style={styles.accountMeta}>Signed in as {user.email}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  hero: { gap: spacing.xs },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: typography.semibold,
    textTransform: "uppercase",
  },
  title: {
    ...typography.screenTitle,
    color: colors.navy,
    fontFamily: typography.bold,
  },
  subtitle: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textTransform: "capitalize",
  },
  statCard: { gap: spacing.md },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statCopy: { flex: 1 },
  statValue: {
    ...typography.screenTitle,
    color: colors.navy,
    fontFamily: typography.bold,
    fontSize: 28,
  },
  statLabel: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  cardBody: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  linkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  accountMeta: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.regular,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
