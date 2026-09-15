import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour, hasCompletedAppTour } from "@/lib/app-tour";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { getToken } from "@/lib/session";
import { layout } from "@/constants/theme";
import {
  colors,
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import type { Circle } from "@/lib/api";

type Props = {
  visible: boolean;
  circles: Circle[];
  onFinished: () => void;
};

export function HomeTourOverlay({ visible, circles, onFinished }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    trackEvent("tour_started");
    trackEvent("tour_step_view", { step: "circles" });
    getToken().then((t) => {
      if (t) setToken(t);
    });
  }, [visible]);

  async function finish(completed: boolean, skippedFrom: string) {
    if (!completedRef.current) {
      completedRef.current = true;
      trackEvent("tour_completed");
    }
    if (!completed) {
      trackEvent("tour_skipped", { step: skippedFrom });
    }
    await completeAppTour();
    onFinished();
  }

  async function onAsk() {
    trackEvent("tour_first_post_started");
    if (!completedRef.current) {
      completedRef.current = true;
      trackEvent("tour_completed");
    }
    const t = token ?? (await getToken());
    const list = t ? circles : circles;
    const primary = pickPrimaryCircle(list);
    await completeAppTour();
    onFinished();
    if (primary) {
      router.push({
        pathname: "/circles/[circleId]/new-post",
        params: {
          circleId: primary.id,
          title: primary.displayName,
        },
      });
    }
  }

  if (!visible) return null;

  const stepKey = step === 1 ? "circles" : "ask";

  return (
    <View style={styles.scrim}>
      <View style={styles.dim} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <View style={styles.card}>
          <View style={styles.top}>
            <View style={styles.dots}>
              {[1, 2].map((n) => (
                <View
                  key={n}
                  style={[styles.dot, n === step && styles.dotActive]}
                />
              ))}
            </View>
            <Pressable
              onPress={() => finish(false, stepKey)}
              accessibilityRole="button"
              hitSlop={12}
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          {step === 1 ? (
            <>
              <Text style={styles.title}>This is your feed</Text>
              <Text style={styles.subtitle}>
                Posts from your circles land here. Use the tabs below for
                Circles, market and more.
              </Text>
              <PrimaryButton
                label="Next"
                onPress={() => {
                  setStep(2);
                  trackEvent("tour_step_view", { step: "ask" });
                }}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.title}>Ask anything</Text>
              <Text style={styles.subtitle}>
                Tap Post on this screen. You stay anonymous — other parents only
                see your handle.
              </Text>
              <PrimaryButton label="Ask your first question" onPress={onAsk} />
              <View style={styles.gap} />
              <SecondaryButton
                label="Later"
                onPress={() => finish(true, "ask")}
              />
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function useHomeTour(ready = true) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    hasCompletedAppTour().then((done) => {
      if (!done) setVisible(true);
    });
  }, [ready]);

  return {
    visible,
    dismiss: () => setVisible(false),
  };
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "flex-end",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    alignSelf: "center",
    maxWidth: layout.formMaxWidth,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  skip: { color: colors.textMuted, fontWeight: "600" },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 12,
  },
  gap: { height: 8 },
});
