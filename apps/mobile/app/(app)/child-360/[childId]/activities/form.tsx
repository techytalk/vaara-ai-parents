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
import {
  PRESCHOOL_SETTINGS,
  SCHOOL_SETTINGS,
} from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useLeaveWithoutSaving } from "@/hooks/useLeaveWithoutSaving";
import { api } from "@/lib/api";
import { setChild360Undo } from "@/lib/child360Undo";
import { getToken } from "@/lib/session";

export default function ActivityFormScreen() {
  const { childId, activityId } = useLocalSearchParams<{
    childId: string;
    activityId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const editing = Boolean(activityId);

  const [track, setTrack] = useState<"school" | "preschool">("school");
  const [name, setName] = useState("");
  const [setting, setSetting] = useState<string | null>(null);
  const [howOften, setHowOften] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings =
    track === "preschool" ? PRESCHOOL_SETTINGS : SCHOOL_SETTINGS;

  useLeaveWithoutSaving(dirty, saving);

  useLayoutEffect(() => {
    const noun = track === "preschool" ? "activity" : "sport";
    navigation.setOptions({
      title: editing ? `Edit ${noun}` : `Add a ${noun}`,
    });
  }, [navigation, track, editing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/(auth)/login");
          return;
        }
        const hub = await api.getChild360(token, childId);
        if (cancelled) return;
        setTrack(hub.child.track);
        if (activityId) {
          const row = hub.activities.find((a) => a.id === activityId);
          if (!row) {
            setError("Activity not found");
            return;
          }
          setName(row.name);
          setSetting(row.setting);
          setHowOften(row.howOften ?? "");
          setStatus(row.status === "paused" ? "paused" : "active");
        } else {
          setSetting(
            hub.child.track === "preschool" ? "preschool" : "school"
          );
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
  }, [activityId, childId, router]);

  const markDirty = useCallback(() => setDirty(true), []);

  const canSave = Boolean(name.trim() && setting) && !saving;

  async function onSave() {
    if (!canSave || !setting) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const body = {
        name: name.trim(),
        setting,
        howOften: howOften.trim() || null,
        status,
      };
      if (editing && activityId) {
        await api.updateChildActivity(token, childId, activityId, body);
      } else {
        await api.createChildActivity(token, childId, body);
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
    if (!activityId) return;
    const label = name.trim() || (track === "preschool" ? "activity" : "sport");
    Alert.alert(`Remove ${label}?`, "You can undo for a moment after.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const token = await getToken();
              if (!token) return;
              const result = await api.deleteChildActivity(
                token,
                childId,
                activityId
              );
              setChild360Undo({
                kind: "activity",
                childId,
                name: result.deleted.name,
                setting: result.deleted.setting,
                howOften: result.deleted.howOften,
                status: result.deleted.status,
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
      <Text style={styles.label}>
        {track === "preschool" ? "Activity" : "Sport"}
      </Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          markDirty();
        }}
        placeholder={track === "preschool" ? "Swimming" : "Football"}
        placeholderTextColor={colors.textSubtle}
        maxLength={40}
        style={styles.input}
      />

      <Text style={styles.label}>Where</Text>
      <View style={styles.chips}>
        {settings.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              setSetting(opt.value);
              markDirty();
            }}
            style={[
              styles.chip,
              setting === opt.value && styles.chipOn,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                setting === opt.value && styles.chipTextOn,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>How often</Text>
      <TextInput
        value={howOften}
        onChangeText={(t) => {
          setHowOften(t);
          markDirty();
        }}
        placeholder="4 days a week"
        placeholderTextColor={colors.textSubtle}
        maxLength={80}
        style={styles.input}
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.chips}>
        {(["active", "paused"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              setStatus(s);
              markDirty();
            }}
            style={[styles.chip, status === s && styles.chipOn]}
          >
            <Text
              style={[
                styles.chipText,
                status === s && styles.chipTextOn,
              ]}
            >
              {s === "active" ? "Active" : "Paused"}
            </Text>
          </Pressable>
        ))}
      </View>

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
          <Text style={styles.removeText}>
            Remove this {track === "preschool" ? "activity" : "sport"}
          </Text>
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
  label: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
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
