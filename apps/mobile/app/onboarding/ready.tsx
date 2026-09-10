import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type Circle } from "@/lib/api";
import { trackEvent, trackOnboardingComplete } from "@/lib/analytics";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import {
  getOnboardingCircles,
  getOnboardingUser,
} from "@/lib/onboarding-draft";
import { colors, PrimaryButton } from "@/components/onboarding/ui";
import { circleTypeIcon } from "@/components/tour/TourFrame";

export default function OnboardingReadyScreen() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("onboarding_ready_view");
    getToken().then(async (token) => {
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }
      try {
        const draftedCircles = getOnboardingCircles();
        const draftedUser = getOnboardingUser();
        if (draftedCircles) {
          setCircles(draftedCircles);
          if (draftedUser) {
            const stored = await getStoredUser();
            if (stored) {
              await saveSession(token, { ...stored, ...draftedUser });
            }
          }
        } else {
          const [list, me] = await Promise.all([
            api.getCircles(token),
            api.me(token),
          ]);
          setCircles(list);
          const stored = await getStoredUser();
          if (stored) {
            await saveSession(token, { ...stored, ...me });
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your circles");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function onStart() {
    // Keep draft seed for home meta; home clears it after first load.
    trackOnboardingComplete();
    router.replace("/(app)" as never);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const count = circles.length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      <View style={styles.hero}>
        <View style={styles.iconLg}>
          <Ionicons name="sparkles" size={32} color={colors.primary} />
        </View>
        <View style={styles.iconSm}>
          <Ionicons name="people" size={16} color={colors.accent} />
        </View>
      </View>

      <Text style={styles.kicker}>You&apos;re in</Text>
      <Text style={styles.title}>
        {count > 0
          ? `You're connected to ${count} circle${count === 1 ? "" : "s"}`
          : "You're connected"}
      </Text>
      <Text style={styles.lead}>
        {count > 0
          ? "These parent groups were created for you from your neighbourhood, school, board and class."
          : "We'll add parent groups as soon as your school and class are set."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {circles.map((circle) => (
          <View key={circle.id} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={circleTypeIcon(circle.circleType)}
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.circleName} numberOfLines={2}>
              {circle.displayName}
            </Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="See your feed" onPress={onStart} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    padding: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  hero: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconLg: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  iconSm: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
    marginLeft: 40,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 20,
    textAlign: "center",
  },
  list: { marginBottom: 28, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  circleName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontWeight: "600",
  },
  error: { color: colors.error, marginBottom: 12, textAlign: "center" },
});
