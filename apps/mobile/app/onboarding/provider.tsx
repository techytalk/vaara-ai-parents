import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, InlineError, SectionHeader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
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

      <SectionHeader title="Provider type" />
      <View style={styles.chipRow}>
        {PROVIDER_TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            selected={providerType === t.value}
            onPress={() => setProviderType(t.value)}
          />
        ))}
      </View>

      <Text style={styles.label}>Organization / business name</Text>
      <TextInput
        style={styles.input}
        placeholder="Organization / business name"
        placeholderTextColor={colors.textSubtle}
        value={orgName}
        onChangeText={setOrgName}
        accessibilityLabel="Organization name"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Short description"
        placeholderTextColor={colors.textSubtle}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
        accessibilityLabel="Provider description"
      />

      <Text style={styles.label}>Service pin codes</Text>
      <TextInput
        style={styles.input}
        placeholder="Comma separated pin codes"
        placeholderTextColor={colors.textSubtle}
        value={pinCodesText}
        onChangeText={setPinCodesText}
        accessibilityLabel="Service pin codes"
      />

      {error ? <InlineError message={error} /> : null}

      <Button
        label="Finish setup"
        onPress={onFinish}
        loading={loading}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    fontFamily: typography.regular,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    minHeight: 44,
  },
  multiline: { minHeight: 90 },
  cta: { marginTop: spacing.sm },
});
