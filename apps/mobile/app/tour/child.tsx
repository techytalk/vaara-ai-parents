import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Child } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour } from "@/lib/app-tour";
import { childDobBounds, toIsoDateOnly } from "@/lib/dates";
import { getToken } from "@/lib/session";
import { DateField } from "@/components/DateTimeField";
import {
  colors,
  FieldInput,
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import { TourFrame, TourHero } from "@/components/tour/TourFrame";

export default function TourChildScreen() {
  const router = useRouter();
  const [child, setChild] = useState<Child | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    trackEvent("tour_step_view", { step: "child" });
    void completeAppTour();
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
        const kids = await api.getChildren(t);
        const first = kids[0] ?? null;
        setChild(first);
        if (first?.nickname) setNickname(first.nickname);
        if (first?.dateOfBirth) {
          const [y, m, d] = first.dateOfBirth.split("-").map(Number);
          setDateOfBirth(new Date(y, (m ?? 1) - 1, d ?? 1));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load child");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function leaveTour(completed: boolean) {
    if (completed && !completedRef.current) {
      completedRef.current = true;
      trackEvent("tour_completed");
    }
    await completeAppTour();
    router.replace("/(app)");
  }

  async function onSkip() {
    trackEvent("tour_skipped", { step: "child" });
    await leaveTour(false);
  }

  async function onLater() {
    await leaveTour(true);
  }

  async function onSave() {
    if (!token || !child) return;
    const nick = nickname.trim();
    setError(null);
    setSubmitting(true);
    try {
      const body: {
        nickname?: string;
        dateOfBirth?: string;
      } = {};
      if (nick) body.nickname = nick;
      if (dateOfBirth) body.dateOfBirth = toIsoDateOnly(dateOfBirth);

      if (Object.keys(body).length > 0) {
        await api.updateChild(token, child.id, body);
        trackEvent("child_identity_saved", { source: "tour" });
      }
      await leaveTour(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dobBounds = childDobBounds();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TourFrame
        step={3}
        title="A private nickname"
        subtitle="Only you see it. Other parents never do."
        onSkip={onSkip}
        footer={
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {child ? (
              <PrimaryButton
                label="Save"
                onPress={onSave}
                loading={submitting}
                disabled={!nickname.trim() && !dateOfBirth}
              />
            ) : null}
            <View style={styles.gap} />
            <SecondaryButton label="Later" onPress={onLater} />
          </>
        }
      >
        <TourHero primaryIcon="heart" secondaryIcon="lock-closed" />
        {!child ? (
          <Text style={styles.error}>
            You can add this later from My children.
          </Text>
        ) : (
          <View>
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
          </View>
        )}
      </TourFrame>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  gap: { height: 10 },
  error: { color: colors.error, marginBottom: 12 },
});
