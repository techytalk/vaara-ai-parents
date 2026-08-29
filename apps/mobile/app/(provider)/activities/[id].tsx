import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ACTIVITY_CATEGORY_OPTIONS } from "@/constants/activities";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Activity, type ActivityCategory } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("other");
  const [pinCodesText, setPinCodesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const list = await api.getProviderActivities(token);
        const found = list.find((a) => a.id === id);
        if (!found) {
          setError("Not found");
          return;
        }
        setActivity(found);
        setTitle(found.title);
        setDescription(found.description);
        setCategory(found.category);
        setPinCodesText(found.pinCodes.join(", "));
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function onSave(status?: string) {
    const pins = pinCodesText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.updateProviderActivity(token, id, {
        title: title.trim(),
        description: description.trim(),
        category,
        pinCodes: pins,
        status: status ?? activity?.status,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert("Delete activity?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.deleteProviderActivity(token, id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.centered}>
        <Text>{error ?? "Activity not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.status}>Status: {activity.status}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
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
        value={pinCodesText}
        onChangeText={setPinCodesText}
        placeholder="Pin codes"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={() => onSave()} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save changes</Text>
        )}
      </Pressable>

      {activity.status !== "published" && (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => onSave("published")}
          disabled={saving}
        >
          <Text style={styles.secondaryBtnText}>Publish</Text>
        </Pressable>
      )}

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>Delete activity</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  status: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.sm,
    textTransform: "capitalize",
  },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: { color: colors.textInverse, fontFamily: typography.semibold },
  secondaryBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  deleteBtn: {
    marginTop: spacing.md,
    alignItems: "center",
    padding: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  deleteBtnText: { color: colors.error, fontFamily: typography.semibold },
  error: { color: colors.error, marginBottom: spacing.xs },
});
