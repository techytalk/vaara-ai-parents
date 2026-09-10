import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
    // Reaching the last step retires the tour, whatever happens next.
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
      // The tour ends here. Adding more children is a separate prompt that
      // arrives later, once the parent has actually used the app.
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>3 of 3</Text>
      <Text style={styles.title}>Your child</Text>
      <Text style={styles.lead}>
        Add a private nickname so your circles make sense to you. Other parents
        never see it.
      </Text>

      {!child ? (
        <Text style={styles.error}>
          No child profile found. You can add one from My children later.
        </Text>
      ) : (
        <>
          <FieldInput
            label="Nickname"
            placeholder="e.g. Aarav — kept private"
            value={nickname}
            onChangeText={setNickname}
            hint="Never shown to other parents"
          />
          <View style={styles.dobField}>
            <DateField
              label="Date of birth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              minimumDate={dobBounds.minimumDate}
              maximumDate={dobBounds.maximumDate}
              hint="Optional — private, never shown to other parents"
            />
          </View>
        </>
      )}

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

      <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Skip tour</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
    paddingBottom: 40,
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
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginTop: 12,
    marginBottom: 20,
  },
  dobField: { marginBottom: 16 },
  gap: { height: 10 },
  error: { color: colors.error, marginBottom: 12 },
  skip: { alignItems: "center", marginTop: 16, padding: 8 },
  skipText: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
});
