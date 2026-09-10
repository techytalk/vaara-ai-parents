import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, type Circle } from "@/lib/api";
import { trackEvent, trackOnboardingComplete } from "@/lib/analytics";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import { clearOnboardingDraft } from "@/lib/onboarding-draft";
import { colors, PrimaryButton } from "@/components/onboarding/ui";

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
        const [list, me] = await Promise.all([
          api.getCircles(token),
          api.me(token),
        ]);
        setCircles(list);
        const stored = await getStoredUser();
        if (stored) {
          await saveSession(token, { ...stored, ...me });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your circles");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function onStart() {
    clearOnboardingDraft();
    trackOnboardingComplete();
    router.replace("/tour/circles" as never);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>You&apos;re in</Text>
      <Text style={styles.title}>
        {circles.length > 0
          ? `You're in ${circles.length} circle${circles.length === 1 ? "" : "s"}`
          : "You're in"}
      </Text>
      <Text style={styles.lead}>
        These are the parent groups matched to your neighbourhood, school,
        board and class.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {circles.map((circle) => (
          <View key={circle.id} style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.circleName}>{circle.displayName}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Start exploring" onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.6,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 20,
  },
  list: { marginBottom: 28, gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  circleName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    fontWeight: "600",
  },
  error: { color: colors.error, marginBottom: 12 },
});
