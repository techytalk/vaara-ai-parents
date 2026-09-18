import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";
import {
  getOnboardingLocation,
  getOnboardingSchool,
  getOnboardingTrack,
  hydrateOnboardingDraft,
  setOnboardingLocation,
  setOnboardingSchoolAsync,
  setOnboardingStep,
  setOnboardingTrack,
} from "@/lib/onboarding-draft";
import { SchoolPicker } from "@/components/onboarding/SchoolPicker";
import {
  Chip,
  colors,
  FieldLabel,
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

type CampusList = "preschool" | "school";

function schoolHook(
  track: CampusList,
  school: School | null
): { title: ReactNode; body?: string } {
  if (track === "preschool") {
    if (!school) {
      return {
        title: (
          <>
            Find parents of{" "}
            <Text style={hookAccent}>3- and 4-year-olds</Text> nearby.
          </>
        ),
      };
    }
    return {
      title: (
        <>
          Connect with parents at{" "}
          <Text style={hookAccent}>{school.name}</Text>.
        </>
      ),
    };
  }

  const actionLine = "Ask Questions - Share Experiences";
  if (!school) {
    return {
      title: (
        <>
          Connect with other parents from same school{" "}
          <Text style={hookAccent}>anonymously</Text>.{"\n"}
          {actionLine}
        </>
      ),
    };
  }

  return {
    title: (
      <>
        Connect with other parents at{" "}
        <Text style={hookAccent}>{school.name}</Text> anonymously.{"\n"}
        {actionLine}
      </>
    ),
  };
}

export default function OnboardingSchoolScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [track, setTrack] = useState<CampusList>("school");
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
  const hook = schoolHook(track, selectedSchool);

  useEffect(() => {
    setOnboardingStep("school");
    trackEvent("onboarding_school_view");
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
        const savedTrack = getOnboardingTrack();
        if (savedTrack === "preschool" || savedTrack === "school") {
          setTrack(savedTrack);
        }
        const existingSchool = getOnboardingSchool();
        if (existingSchool?.id && existingSchool.name) {
          setSelectedSchool(existingSchool);
          if (existingSchool.kind === "preschool") {
            setTrack("preschool");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load location");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function onSelectTrack(next: CampusList) {
    if (next === track) return;
    setTrack(next);
    setOnboardingTrack(next);
    setSelectedSchool(null);
    void setOnboardingSchoolAsync(null);
    setError(null);
    trackEvent("onboarding_track_selected", { track: next });
  }

  async function onContinue() {
    if (!selectedSchool) {
      setError(
        track === "preschool"
          ? "Select a preschool or school campus to continue"
          : "Select your child's school to continue"
      );
      return;
    }
    setOnboardingTrack(track);
    await setOnboardingSchoolAsync(selectedSchool);
    const schoolKind = selectedSchool.kind ?? "school";
    trackEvent("onboarding_school_complete", {
      track,
      school_verified: selectedSchool.verified,
      school_kind: schoolKind,
      offers_preschool: Boolean(selectedSchool.offersPreschool),
    });
    if (track === "preschool") {
      trackEvent("preschool_selected", { school_kind: schoolKind });
      router.push("/onboarding/age" as never);
      return;
    }
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

      <FieldLabel>What describes your child?</FieldLabel>
      <View style={styles.trackRow}>
        <Chip
          label="Preschool (3–4 years)"
          selected={track === "preschool"}
          onPress={() => onSelectTrack("preschool")}
        />
        <Chip
          label="School"
          selected={track === "school"}
          onPress={() => onSelectTrack("school")}
        />
      </View>

      <SchoolPicker
        key={track}
        token={token}
        selected={selectedSchool}
        onSelect={setSelectedSchool}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
        defaultLocality={defaultLocality}
        defaultCountry={defaultCountry}
        onCreateModeChange={setAddingSchool}
        offersPreschoolOnCreate={track === "preschool"}
        createLabel="Add school"
        label={track === "preschool" ? "Preschool / school campus" : "School"}
        placeholder={
          track === "preschool" ? "Select preschool or school" : "Select school"
        }
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  trackRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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
