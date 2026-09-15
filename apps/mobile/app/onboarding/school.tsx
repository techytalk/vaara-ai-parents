import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";
import {
  getOnboardingLocation,
  getOnboardingSchool,
  hydrateOnboardingDraft,
  setOnboardingLocation,
  setOnboardingSchoolAsync,
  setOnboardingStep,
} from "@/lib/onboarding-draft";
import { SchoolPicker } from "@/components/onboarding/SchoolPicker";
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

function schoolHook(school: School | null): { title: ReactNode; body: string } {
  if (!school) {
    return {
      title: (
        <>
          Join the parent community at{" "}
          <Text style={hookAccent}>your child&apos;s school</Text>
        </>
      ),
      body: "Connect with parents from the same school to ask questions, share experiences and get real insights about school life.",
    };
  }

  return {
    title: (
      <>
        What&apos;s it really like at{" "}
        <Text style={hookAccent}>{school.name}</Text>?
      </>
    ),
    body: "Find parents from the same school to ask questions, share experiences and get real insights about school life.",
  };
}

export default function OnboardingSchoolScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");
  const [defaultLocality, setDefaultLocality] = useState("");
  const [defaultCountry, setDefaultCountry] = useState("IN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingSchool, setAddingSchool] = useState(false);
  const contentStyle = useOnboardingContentStyle();
  const hook = schoolHook(selectedSchool);

  useEffect(() => {
    setOnboardingStep("school");
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
        await hydrateOnboardingDraft();
        const drafted = getOnboardingLocation();
        const loc = drafted.locationLoaded
          ? drafted.location
          : await api.getLocation(t);
        if (!drafted.locationLoaded) {
          setOnboardingLocation(loc, { loaded: true });
        }
        if (!loc) {
          router.replace("/onboarding/location");
          return;
        }
        setDefaultCity(loc.city ?? "");
        setDefaultPin(loc.pinCode ?? "");
        setDefaultState(loc.state ?? "");
        setDefaultLocality(loc.locality ?? "");
        setDefaultCountry(loc.countryCode ?? "IN");
        const existingSchool = getOnboardingSchool();
        if (existingSchool?.id && existingSchool.name) {
          setSelectedSchool(existingSchool);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load location");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function onContinue() {
    if (!selectedSchool) {
      setError("Select your child's school to continue");
      return;
    }
    await setOnboardingSchoolAsync(selectedSchool);
    trackEvent("onboarding_school_complete");
    router.push("/onboarding/class" as never);
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
      <Text style={styles.step}>Step 2 of 3</Text>
      <OnboardingPayoff
        compact
        title={hook.title}
        body={hook.body}
        illustration={require("../../assets/illustrations/onboarding-school-same-school.jpg")}
      />

      <SchoolPicker
        token={token}
        selected={selectedSchool}
        onSelect={setSelectedSchool}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
        defaultLocality={defaultLocality}
        defaultCountry={defaultCountry}
        onCreateModeChange={setAddingSchool}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!addingSchool ? (
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!selectedSchool}
        />
      ) : null}
      <SecondaryButton
        label="Back"
        onPress={() => router.replace("/onboarding/location" as never)}
      />
      <OnboardingAccountSwitch step="school" />

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
        <Text style={styles.privacyText}>
          Your school is only used to connect you with parents from the same
          school. It is never shared publicly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {},
  step: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 8,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
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
