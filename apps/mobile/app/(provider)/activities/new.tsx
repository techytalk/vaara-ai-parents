import { useEffect, useState } from "react";
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
import {
  ACTIVITY_CATEGORY_OPTIONS,
  defaultCategoryForProvider,
} from "@/constants/activities";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  api,
  type ActivityCategory,
  type Curriculum,
} from "@/lib/api";
import { getToken } from "@/lib/session";

export default function NewActivityScreen() {
  const router = useRouter();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("classes");
  const [locationText, setLocationText] = useState("");
  const [pinCodesText, setPinCodesText] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [selectedCurricula, setSelectedCurricula] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCurricula().then(setCurricula).catch(() => {});
    getToken().then(async (token) => {
      if (!token) return;
      const profile = await api.getProviderProfile(token);
      setCategory(defaultCategoryForProvider(profile?.providerType));
      if (profile?.servicePinCodes?.length) {
        setPinCodesText(profile.servicePinCodes.join(", "));
      }
    });
  }, []);

  function toggleCurriculum(id: string) {
    setSelectedCurricula((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function onSave() {
    const pins = pinCodesText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!title.trim() || !description.trim() || !category || pins.length === 0) {
      setError("Title, description, category, and pin codes are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.createProviderActivity(token, {
        title: title.trim(),
        description: description.trim(),
        category,
        locationText: locationText.trim() || undefined,
        pinCodes: pins,
        curriculumIds: selectedCurricula,
        feeAmount: feeAmount ? Number(feeAmount) : undefined,
        startsAt: startsAt.trim() || undefined,
        status: publish ? "published" : "draft",
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Description"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {ACTIVITY_CATEGORY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.chip,
              category === option.value && styles.chipActive,
            ]}
            onPress={() => setCategory(option.value)}
          >
            <Text
              style={[
                styles.chipText,
                category === option.value && styles.chipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Location (e.g. near metro, sector 2)"
        value={locationText}
        onChangeText={setLocationText}
      />
      <TextInput
        style={styles.input}
        placeholder="Pin codes (comma separated)"
        value={pinCodesText}
        onChangeText={setPinCodesText}
      />
      <TextInput
        style={styles.input}
        placeholder="Fee amount (INR, optional)"
        keyboardType="decimal-pad"
        value={feeAmount}
        onChangeText={setFeeAmount}
      />
      <TextInput
        style={styles.input}
        placeholder="Starts at (ISO date optional)"
        value={startsAt}
        onChangeText={setStartsAt}
      />

      <Text style={styles.label}>Target curricula (optional — empty = all)</Text>
      <View style={styles.chipRow}>
        {curricula.map((c) => (
          <Pressable
            key={c.id}
            style={[
              styles.chip,
              selectedCurricula.includes(c.id) && styles.chipActive,
            ]}
            onPress={() => toggleCurriculum(c.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCurricula.includes(c.id) && styles.chipTextActive,
              ]}
            >
              {c.code}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.toggle}
        onPress={() => setPublish((p) => !p)}
      >
        <Text style={styles.toggleText}>
          {publish ? "✓ Publish immediately" : "Save as draft"}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save activity</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    color: colors.text,
    fontFamily: typography.regular,
  },
  multiline: { minHeight: 120 },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontFamily: typography.medium },
  chipTextActive: { color: colors.textInverse, fontFamily: typography.semibold },
  toggle: { marginBottom: spacing.sm },
  toggleText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: {
    color: colors.textInverse,
    fontFamily: typography.semibold,
    fontSize: 16,
  },
  error: { color: colors.error, marginBottom: spacing.xs },
});
