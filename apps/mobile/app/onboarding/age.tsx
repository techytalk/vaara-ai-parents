import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken, saveSession } from "@/lib/session";
import {
  ensureOnboardingAttemptId,
  getOnboardingAgeYears,
  getOnboardingLocation,
  getOnboardingSchool,
  getOnboardingTrack,
  hydrateOnboardingDraft,
  setOnboardingAgeYears,
  setOnboardingChildren,
  setOnboardingCircles,
  setOnboardingStep,
  setOnboardingUser,
} from "@/lib/onboarding-draft";
import {
  colors,
  OnboardingPayoff,
  PrimaryButton,
  SecondaryButton,
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";
import { OnboardingAccountSwitch } from "@/components/SignOutButton";

const hookAccent = {
  color: colors.primary,
  textDecorationLine: "underline" as const,
  textDecorationColor: colors.primaryLight,
};

function ageHook(pin: string): { title: ReactNode; body: string } {
  return {
    title: (
      <>
        Join parents of children the{" "}
        <Text style={hookAccent}>same age</Text> in your area.
      </>
    ),
    body: pin
      ? `Pick 3 years or 4 years. You will join that circle for PIN ${pin}.`
      : "Pick 3 years or 4 years for your child.",
  };
}

export default function OnboardingAgeScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ageYears, setAgeYears] = useState<3 | 4 | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentStyle = useOnboardingContentStyle();
  const hook = ageHook(pin);

  useEffect(() => {
    setOnboardingStep("age");
    trackEvent("onboarding_age_view");
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
        await hydrateOnboardingDraft();
        const track = getOnboardingTrack();
        const school = getOnboardingSchool();
        const loc = getOnboardingLocation().location;
        if (track !== "preschool" || !school?.id) {
          router.replace("/onboarding/school" as never);
          return;
        }
        setPin(loc?.pinCode ?? "");
        const saved = getOnboardingAgeYears();
        if (saved === 3 || saved === 4) setAgeYears(saved);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function onFinish() {
    if (!token || (ageYears !== 3 && ageYears !== 4)) return;
    const school = getOnboardingSchool();
    if (!school?.id) {
      router.replace("/onboarding/school" as never);
      return;
    }

    setError(null);
    setSubmitting(true);
    setOnboardingAgeYears(ageYears);
    try {
      const result = await api.addChild(token, {
        track: "preschool",
        schoolId: school.id,
        ageYears,
        gender: "unspecified",
        onboardingAttemptId: ensureOnboardingAttemptId(),
      });
      setOnboardingChildren([result.child]);
      if (result.circles) setOnboardingCircles(result.circles);
      if (result.user) {
        setOnboardingUser(result.user);
        await saveSession(token, result.user);
      }
      trackEvent("onboarding_age_complete", { age_years: ageYears });
      trackEvent("age_circle_selected", { age_years: ageYears });
      router.replace("/onboarding/ready" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingPayoff
        compact
        title={hook.title}
        body={hook.body}
        illustration={require("../../assets/illustrations/onboarding-school-same-school.png")}
        anonymousAvatars={[
          require("../../assets/illustrations/onboarding-anon-fox.png"),
          require("../../assets/illustrations/onboarding-anon-owl.png"),
          require("../../assets/illustrations/onboarding-anon-panda.png"),
        ]}
      />

      <View style={styles.options}>
        {([3, 4] as const).map((years) => {
          const selected = ageYears === years;
          return (
            <Pressable
              key={years}
              onPress={() => {
                setAgeYears(years);
                trackEvent("age_circle_selected", { age_years: years });
              }}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text
                style={[styles.optionTitle, selected && styles.optionTitleSelected]}
              >
                {years} years
              </Text>
              <Text style={styles.optionBody}>
                {pin
                  ? `Parents of ${years}-year-olds · ${pin}`
                  : `Parents of ${years}-year-olds nearby`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={submitting ? "Joining…" : "Continue"}
        onPress={onFinish}
        disabled={ageYears == null || submitting}
      />
      <SecondaryButton
        label="Back"
        onPress={() => router.replace("/onboarding/school" as never)}
      />
      <OnboardingAccountSwitch step="age" />

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
        <Text style={styles.privacyText}>
          Age is only used to place you in the right parent circle. We do not
          ask for a date of birth here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {},
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  options: { gap: 12, marginBottom: 16 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.bg,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  optionTitleSelected: { color: colors.primary },
  optionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  error: { color: colors.error, marginBottom: 8 },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
