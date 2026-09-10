import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";
import {
  getOnboardingLocation,
  setOnboardingLocation,
  setOnboardingSchool,
} from "@/lib/onboarding-draft";
import { SchoolPicker } from "@/components/onboarding/SchoolPicker";
import {
  colors,
  OnboardingPayoff,
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function OnboardingSchoolScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingSchool, setAddingSchool] = useState(false);

  useEffect(() => {
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load location");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function onContinue() {
    if (!selectedSchool) {
      setError("Select your child's school to continue");
      return;
    }
    setOnboardingSchool(selectedSchool);
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
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.step}>Step 2 of 3</Text>
      <OnboardingPayoff
        primaryIcon="school"
        secondaryIcon="people"
        title="Connect with every parent at your child's school and branch"
        body="Pick the school so we can place you in the right parent circle — not a public directory."
      />
      <Text style={styles.formTitle}>Where does your child go to school?</Text>

      <SchoolPicker
        token={token}
        selected={selectedSchool}
        onSelect={setSelectedSchool}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
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
      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  step: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: colors.error, marginBottom: 8 },
});
