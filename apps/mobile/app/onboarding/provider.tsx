import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { getStoredUser, getToken, saveSession } from "@/lib/session";

const PROVIDER_TYPES = [
  { value: "teacher", label: "Teacher / Tutor" },
  { value: "trainer", label: "Trainer" },
  { value: "institution", label: "Institution" },
];

export default function ProviderOnboardingScreen() {
  const router = useRouter();
  const [providerType, setProviderType] = useState("teacher");
  const [orgName, setOrgName] = useState("");
  const [description, setDescription] = useState("");
  const [pinCodesText, setPinCodesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish() {
    const pins = pinCodesText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!orgName.trim() || pins.length === 0) {
      setError("Organization name and at least one pin code are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const profile = await api.updateProviderProfile(token, {
        providerType,
        orgName: orgName.trim(),
        description: description.trim() || undefined,
        servicePinCodes: pins,
      });

      const stored = await getStoredUser();
      if (stored) {
        await saveSession(token, {
          ...stored,
          onboardingComplete: profile.onboardingComplete,
        });
      }

      router.replace("/(provider)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Tell parents who you are and which pin codes you serve. Your organization
        name is shown on activities — parent identities stay private.
      </Text>

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {PROVIDER_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[
              styles.chip,
              providerType === t.value && styles.chipActive,
            ]}
            onPress={() => setProviderType(t.value)}
          >
            <Text
              style={[
                styles.chipText,
                providerType === t.value && styles.chipTextActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Organization / business name"
        value={orgName}
        onChangeText={setOrgName}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Short description (optional)"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        placeholder="Service pin codes (comma separated)"
        value={pinCodesText}
        onChangeText={setPinCodesText}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onFinish} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Finish setup</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  content: { padding: 20 },
  lead: { fontSize: 15, color: "#5c5c7a", lineHeight: 22, marginBottom: 20 },
  label: { fontSize: 13, color: "#5c5c7a", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e4ef",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 13, color: "#1a1a2e" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 90 },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 8 },
});
