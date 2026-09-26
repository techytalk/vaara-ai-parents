import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { HEALTH_LABEL_OPTIONS } from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useLeaveWithoutSaving } from "@/hooks/useLeaveWithoutSaving";
import { api } from "@/lib/api";
import { setChild360Undo } from "@/lib/child360Undo";
import { getToken } from "@/lib/session";

export default function HealthFormScreen() {
  const { childId, noteId } = useLocalSearchParams<{
    childId: string;
    noteId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const editing = Boolean(noteId);

  const [label, setLabel] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLeaveWithoutSaving(dirty, saving);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editing ? "Edit note" : "Add a note",
    });
  }, [navigation, editing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/(auth)/login");
          return;
        }
        if (noteId) {
          const hub = await api.getChild360(token, childId);
          const row = hub.healthNotes.find((n) => n.id === noteId);
          if (!row) {
            setError("Note not found");
            return;
          }
          if (!cancelled) {
            setLabel(row.label);
            setBody(row.body);
          }
        } else if (!cancelled) {
          setLabel("allergy");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, noteId, router]);

  const canSave = Boolean(label && body.trim()) && !saving;

  async function onSave() {
    if (!canSave || !label) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      if (editing && noteId) {
        await api.updateChildHealthNote(token, childId, noteId, {
          label,
          body: body.trim(),
        });
      } else {
        await api.createChildHealthNote(token, childId, {
          label,
          body: body.trim(),
        });
      }
      setDirty(false);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onRemove() {
    if (!noteId) return;
    Alert.alert("Remove this note?", "You can undo for a moment after.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const token = await getToken();
              if (!token) return;
              const result = await api.deleteChildHealthNote(
                token,
                childId,
                noteId
              );
              setChild360Undo({
                kind: "health",
                childId,
                label: result.deleted.label,
                body: result.deleted.body,
              });
              setDirty(false);
              router.back();
            } catch (e) {
              Alert.alert(
                "Could not remove",
                e instanceof Error ? e.message : "Try again"
              );
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
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
      <Text style={styles.privacy}>Private to your account.</Text>

      <Text style={styles.label}>What is it</Text>
      <View style={styles.chips}>
        {HEALTH_LABEL_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              setLabel(opt.value);
              setDirty(true);
            }}
            style={[styles.chip, label === opt.value && styles.chipOn]}
          >
            <Text
              style={[
                styles.chipText,
                label === opt.value && styles.chipTextOn,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Note</Text>
      <TextInput
        value={body}
        onChangeText={(t) => {
          setBody(t);
          setDirty(true);
        }}
        placeholder="Dust. Inhaler in the school bag."
        placeholderTextColor={colors.textSubtle}
        maxLength={280}
        multiline
        style={[styles.input, styles.textarea]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void onSave()}
        disabled={!canSave}
        style={[styles.save, !canSave && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>

      {editing ? (
        <Pressable onPress={onRemove} style={styles.remove}>
          <Text style={styles.removeText}>Remove this note</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  privacy: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  chipTextOn: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.text,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  save: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.45 },
  saveText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
  remove: { marginTop: spacing.lg, alignItems: "center", padding: spacing.md },
  removeText: {
    fontFamily: typography.semibold,
    color: colors.error,
    fontSize: 15,
  },
  error: {
    color: colors.error,
    marginTop: spacing.md,
    fontFamily: typography.regular,
  },
});
