import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { settingDisplay } from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useChild360Undo } from "@/hooks/useChild360Undo";
import { api, type ChildActivity, type Child360Hub } from "@/lib/api";
import { clearChild360Undo } from "@/lib/child360Undo";
import { getToken } from "@/lib/session";

export default function ActivitiesListScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [track, setTrack] = useState<"school" | "preschool">("school");
  const [items, setItems] = useState<ChildActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { undo, take } = useChild360Undo(childId, "activity");

  const title = track === "preschool" ? "Activities" : "Sports";

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      clearChild360Undo();
    });
    return unsub;
  }, [navigation]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    const hub: Child360Hub = await api.getChild360(token, childId);
    setTrack(hub.child.track);
    setItems(hub.activities);
    setError(null);
  }, [childId, router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  function openForm(activityId?: string) {
    clearChild360Undo();
    router.push({
      pathname: "/(app)/child-360/[childId]/activities/form",
      params: activityId ? { childId, activityId } : { childId },
    });
  }

  async function restoreUndo() {
    const payload = take();
    if (!payload || payload.kind !== "activity") return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.createChildActivity(token, childId, {
        name: payload.name,
        setting: payload.setting,
        howOften: payload.howOften,
        status: payload.status,
      });
      await load();
    } catch (e) {
      Alert.alert("Could not undo", e instanceof Error ? e.message : "Try again");
    }
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => openForm(item.id)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {settingDisplay(item.setting, track)}
            {item.howOften ? ` · ${item.howOften}` : ""}
            {item.status === "paused" ? " · Paused" : ""}
          </Text>
        </Pressable>
      ))}
      {items.length === 0 ? (
        <Text style={styles.empty}>
          {track === "preschool"
            ? "Add an activity your child does regularly."
            : "Add a sport your child plays."}
        </Text>
      ) : null}
      <Pressable
        onPress={() => openForm()}
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
      >
        <Text style={styles.addBtnText}>
          {track === "preschool" ? "+ Add an activity" : "+ Add a sport"}
        </Text>
      </Pressable>
      {undo && undo.kind === "activity" ? (
        <Pressable onPress={() => void restoreUndo()} style={styles.undo}>
          <Text style={styles.undoText}>Undo remove · {undo.name}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.88 },
  cardTitle: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
  },
  cardMeta: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  empty: {
    fontFamily: typography.regular,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: spacing.lg,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  addBtnText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
  undo: { alignItems: "center", padding: spacing.md },
  undoText: {
    fontFamily: typography.semibold,
    color: colors.primary,
    fontSize: 15,
  },
  error: { color: colors.error, fontFamily: typography.regular },
});
