import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour } from "@/lib/app-tour";
import { colors, PrimaryButton } from "@/components/onboarding/ui";

export default function TourCirclesScreen() {
  const router = useRouter();

  useEffect(() => {
    trackEvent("tour_started");
    trackEvent("tour_step_view", { step: "circles" });
  }, []);

  async function onSkip() {
    trackEvent("tour_skipped", { step: "circles" });
    await completeAppTour();
    router.replace("/(app)");
  }

  function onNext() {
    router.push("/tour/ask" as never);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>1 of 3</Text>
      <Text style={styles.title}>Your circles</Text>
      <Text style={styles.lead}>
        Each circle is a group of parents you share something with — your
        neighbourhood, school, board or class.
      </Text>
      <Text style={styles.body}>
        Open any circle to read posts and ask questions. You stay anonymous;
        other parents only see your handle.
      </Text>

      <PrimaryButton label="Next" onPress={onNext} />
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
  skip: { alignItems: "center", marginTop: 16, padding: 8 },
  skipText: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
});
