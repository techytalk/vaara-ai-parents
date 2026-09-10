import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour } from "@/lib/app-tour";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { getToken } from "@/lib/session";
import { colors, PrimaryButton, SecondaryButton } from "@/components/onboarding/ui";

export default function TourAskScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("tour_step_view", { step: "ask" });
  }, []);

  async function onSkip() {
    trackEvent("tour_skipped", { step: "ask" });
    await completeAppTour();
    router.replace("/(app)");
  }

  function onLater() {
    router.push("/tour/child" as never);
  }

  async function onAsk() {
    trackEvent("tour_first_post_started");
    setLoading(true);
    try {
      const token = await getToken();
      const circles = token ? await api.getCircles(token).catch(() => []) : [];
      const primary = pickPrimaryCircle(circles);
      // The composer navigates away to the new post, so retire the tour here
      // or tapping a tab afterwards would send the parent back to step 1.
      await completeAppTour();
      // Land on the child step when the composer is dismissed.
      router.replace("/tour/child" as never);
      if (primary) {
        router.push({
          pathname: "/circles/[circleId]/new-post",
          params: {
            circleId: primary.id,
            title: primary.displayName,
          },
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>2 of 3</Text>
      <Text style={styles.title}>Ask anything</Text>
      <Text style={styles.lead}>
        Post a question to your school or locality circle. You stay anonymous.
      </Text>
      <Text style={styles.body}>
        Parents in the same circles can reply with advice, recommendations and
        local tips.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <PrimaryButton label="Ask your first question" onPress={onAsk} />
          <View style={styles.gap} />
          <SecondaryButton label="Later" onPress={onLater} />
        </>
      )}

      <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Skip tour</Text>
      </Pressable>
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
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginTop: 12,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 28,
  },
  gap: { height: 10 },
  skip: { alignItems: "center", marginTop: 16, padding: 8 },
  skipText: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
});
