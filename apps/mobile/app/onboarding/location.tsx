import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import {
  colors,
  FieldInput,
  InfoCard,
  OnboardingHeader,
  PrimaryButton,
} from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function LocationScreen() {
  const router = useRouter();
  const [pinCode, setPinCode] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setPrefillLoading(false);
        return;
      }
      try {
        const loc = await api.getLocation(token);
        if (loc) {
          setPinCode(loc.pinCode);
          setLocality(loc.locality ?? "");
          setCity(loc.city ?? "");
          setState(loc.state ?? "");
          setCommunityName(loc.communityName ?? "");
        }
      } finally {
        setPrefillLoading(false);
      }
    });
  }, []);

  async function onFinish() {
    const pin = pinCode.trim();
    if (!pin) {
      setError("Pin code is required");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const result = await api.updateLocation(token, {
        pinCode: pin,
        locality: locality.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        communityName: communityName.trim() || undefined,
      });

      const storedUser = await getStoredUser();
      if (storedUser) {
        await saveSession(token, {
          ...storedUser,
          onboardingComplete: result.onboardingComplete ?? true,
        });
      }

      router.replace("/(app)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save location");
    } finally {
      setLoading(false);
    }
  }

  if (prefillLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader
        step={2}
        totalSteps={2}
        title="Your location"
        subtitle="Help us connect you with parents in your neighbourhood and housing community."
      />

      <InfoCard>
        Your pin code helps us connect you with parents in your vicinity — same
        area, same schooling context. Add your apartment or community name to
        join your housing circle too.
      </InfoCard>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Area & pin code</Text>
        </View>

        <FieldInput
          label="Pin code"
          placeholder="e.g. 560102"
          keyboardType="number-pad"
          maxLength={6}
          value={pinCode}
          onChangeText={setPinCode}
          hint="Required — used to match you with nearby parents"
        />
        <FieldInput
          label="Locality / area"
          placeholder="e.g. Indiranagar, Koramangala"
          value={locality}
          onChangeText={setLocality}
        />
        <FieldInput
          label="City"
          placeholder="e.g. Bengaluru"
          value={city}
          onChangeText={setCity}
        />
        <FieldInput
          label="State"
          placeholder="e.g. Karnataka"
          value={state}
          onChangeText={setState}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Apartment / community</Text>
        </View>
        <FieldInput
          label="Community name (optional)"
          placeholder="e.g. Green Valley Apartments"
          value={communityName}
          onChangeText={setCommunityName}
          hint="Optional — connects you with parents in the same gated community"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={pinCode ? "Save location" : "Finish setup"}
        onPress={onFinish}
        loading={loading}
      />

      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 8 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  error: { color: colors.error, marginBottom: 8 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.textMuted, fontSize: 15 },
});
