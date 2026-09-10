import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour } from "@/lib/app-tour";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { getToken } from "@/lib/session";
import { colors, PrimaryButton, SecondaryButton } from "@/components/onboarding/ui";
import { TourFrame, TourHero } from "@/components/tour/TourFrame";

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
      await completeAppTour();
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
    <TourFrame
      step={2}
      title="Ask anything"
      subtitle="You stay anonymous. Other parents only see your handle."
      onSkip={onSkip}
      footer={
        loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <PrimaryButton label="Ask your first question" onPress={onAsk} />
            <View style={styles.gap} />
            <SecondaryButton label="Later" onPress={onLater} />
          </>
        )
      }
    >
      <TourHero primaryIcon="chatbubbles" secondaryIcon="eye-off" />
      <View style={styles.post}>
        <View style={styles.postHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>V</Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.handle}>VaaraFox</Text>
            <Text style={styles.time}>just now · anonymous</Text>
          </View>
        </View>
        <Text style={styles.postBody}>
          Anyone tried the new after-school programme near the main gate?
        </Text>
      </View>
    </TourFrame>
  );
}

const styles = StyleSheet.create({
  gap: { height: 10 },
  post: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  postHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.textInverse,
    fontWeight: "800",
    fontSize: 16,
  },
  postMeta: { flex: 1 },
  handle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  postBody: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
});
