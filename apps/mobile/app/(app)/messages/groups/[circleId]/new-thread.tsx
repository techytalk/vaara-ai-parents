import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function NewThreadScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const thread = await api.createGroupThread(token, String(circleId), {
        title: title.trim(),
        body: body.trim(),
        kind: "question",
      });
      router.replace({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: thread.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start thread");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Topic</Text>
      <TextInput
        style={styles.input}
        placeholder="Which pediatrician near your PIN?"
        value={title}
        onChangeText={setTitle}
      />
      <Text style={styles.label}>Details</Text>
      <TextInput
        style={[styles.input, styles.area]}
        placeholder="Add context for other parents"
        value={body}
        onChangeText={setBody}
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, !title.trim() && styles.disabled]}
        onPress={() => void submit()}
        disabled={!title.trim() || saving}
      >
        <Text style={styles.buttonLabel}>{saving ? "Starting…" : "Ask"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg, gap: spacing.sm },
  label: { fontFamily: typography.semibold, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.card,
    fontFamily: typography.regular,
    color: colors.text,
  },
  area: { minHeight: 120, textAlignVertical: "top" },
  error: { color: colors.error },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  buttonLabel: { fontFamily: typography.semibold, color: colors.textInverse },
});
