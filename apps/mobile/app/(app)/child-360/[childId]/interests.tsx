import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  ENJOY_INTEREST_CHIPS,
  PRESCHOOL_INTEREST_CHIPS,
} from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useLeaveWithoutSaving } from "@/hooks/useLeaveWithoutSaving";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function InterestsScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [band, setBand] = useState<"interests" | "enjoy">("interests");
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const label of selected) {
      if (!initial.has(label)) return true;
    }
    return false;
  }, [selected, initial]);

  useLeaveWithoutSaving(dirty, saving);

  const chips = useMemo(() => {
    const base =
      band === "enjoy"
        ? [...ENJOY_INTEREST_CHIPS]
        : [...PRESCHOOL_INTEREST_CHIPS];
    const known = new Set<string>(base);
    const extras = [...selected].filter((label) => !known.has(label));
    return [...base, ...extras];
  }, [band, selected]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: band === "enjoy" ? "What they enjoy" : "Interests",
    });
  }, [navigation, band]);

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
        setNickname(hub.child.nickname);
        setBand(hub.child.rightBand === "enjoy" ? "enjoy" : "interests");
        const labels = new Set(hub.interests);
        setSelected(labels);
        setInitial(new Set(labels));
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
  }, [childId, router]);

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.putChildInterests(token, childId, [...selected]);
      setInitial(new Set(selected));
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const who = nickname?.trim() || "they";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.prompt}>
        {band === "enjoy"
          ? `What does ${who} enjoy?`
          : `What does ${who} enjoy?`}
      </Text>
      <View style={styles.chips}>
        {chips.map((label) => {
          const on = selected.has(label);
          return (
            <Pressable
              key={label}
              onPress={() => toggle(label)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={() => void onSave()}
        disabled={saving}
        style={[styles.save, saving && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>
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
  prompt: {
    fontFamily: typography.semibold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
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
    fontSize: 15,
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
  error: {
    color: colors.error,
    marginTop: spacing.md,
    fontFamily: typography.regular,
  },
});
