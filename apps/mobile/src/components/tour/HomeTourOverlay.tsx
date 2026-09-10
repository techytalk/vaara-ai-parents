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
import { api, type Child } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour, hasCompletedAppTour } from "@/lib/app-tour";
import { childDobBounds, toIsoDateOnly } from "@/lib/dates";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { getToken } from "@/lib/session";
import { DateField } from "@/components/DateTimeField";
import {
  colors,
  FieldInput,
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
  const [child, setChild] = useState<Child | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    trackEvent("tour_started");
    trackEvent("tour_step_view", { step: "circles" });
    getToken().then(async (t) => {
      if (!t) return;
      setToken(t);
      const kids = await api.getChildren(t).catch(() => [] as Child[]);
      const first = kids[0] ?? null;
      setChild(first);
      if (first?.nickname) setNickname(first.nickname);
      if (first?.dateOfBirth) {
        const [y, m, d] = first.dateOfBirth.split("-").map(Number);
        setDateOfBirth(new Date(y, (m ?? 1) - 1, d ?? 1));
      }
    });
  }, [visible]);

  async function finish(completed: boolean, skippedFrom: string) {
    if (completed && !completedRef.current) {
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
    const t = token ?? (await getToken());
    const list = t ? await api.getCircles(t).catch(() => []) : circles;
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

  async function onSaveNickname() {
    if (!token || !child) {
      await finish(true, "child");
      return;
    }
    const nick = nickname.trim();
    setError(null);
    setSubmitting(true);
    try {
      const body: { nickname?: string; dateOfBirth?: string } = {};
      if (nick) body.nickname = nick;
      if (dateOfBirth) body.dateOfBirth = toIsoDateOnly(dateOfBirth);
      if (Object.keys(body).length > 0) {
        await api.updateChild(token, child.id, body);
        trackEvent("child_identity_saved", { source: "tour" });
      }
      await finish(true, "child");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  const dobBounds = childDobBounds();
  const stepKey = step === 1 ? "circles" : step === 2 ? "ask" : "child";

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
              {[1, 2, 3].map((n) => (
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
                onPress={() => {
                  setStep(3);
                  trackEvent("tour_step_view", { step: "child" });
                }}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.title}>A private nickname</Text>
              <Text style={styles.subtitle}>
                Only you see it. Other parents never do.
              </Text>
              {child ? (
                <>
                  <FieldInput
                    label="Nickname"
                    placeholder="e.g. Aarav"
                    value={nickname}
                    onChangeText={setNickname}
                  />
                  <DateField
                    label="Date of birth (optional)"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    minimumDate={dobBounds.minimumDate}
                    maximumDate={dobBounds.maximumDate}
                  />
                </>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {child ? (
                <PrimaryButton
                  label="Save"
                  onPress={onSaveNickname}
                  loading={submitting}
                  disabled={!nickname.trim() && !dateOfBirth}
                />
              ) : (
                <PrimaryButton
                  label="Done"
                  onPress={() => finish(true, "child")}
                />
              )}
              <View style={styles.gap} />
              <SecondaryButton
                label="Later"
                onPress={() => finish(true, "child")}
              />
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function useHomeTour(ready: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void hasCompletedAppTour().then((done) => {
        if (!cancelled && !done) setVisible(true);
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready]);

  return {
    visible,
    dismiss: () => setVisible(false),
  };
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13, 27, 42, 0.35)",
  },
  card: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  skip: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 16,
  },
  gap: { height: 10 },
  error: { color: colors.error, marginBottom: 8 },
});
