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
import { PLAN_STATUS_OPTIONS } from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useChild360Undo } from "@/hooks/useChild360Undo";
import { api, type ChildOpportunityPlan } from "@/lib/api";
import { clearChild360Undo } from "@/lib/child360Undo";
import { getToken } from "@/lib/session";

function statusLabel(status: string): string {
  return (
    PLAN_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

export default function OpportunitiesListScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [items, setItems] = useState<ChildOpportunityPlan[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { undo, take } = useChild360Undo(childId, "opportunity");

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Exams" });
  }, [navigation]);

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
    const [hub, pathwayHub] = await Promise.all([
      api.getChild360(token, childId),
      api.getPathwaysHub(token, { childId }).catch(() => null),
    ]);
    setItems(hub.opportunityPlans);
    const map: Record<string, string> = {};
    for (const group of pathwayHub?.groups ?? []) {
      for (const card of group.cards) {
        if (card.slug.startsWith("_")) continue;
        map[card.slug] = card.title;
      }
    }
    setTitles(map);
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

  function openForm(planId?: string) {
    clearChild360Undo();
    router.push({
      pathname: "/(app)/child-360/[childId]/opportunities/form",
      params: planId ? { childId, planId } : { childId },
    });
  }

  async function restoreUndo() {
    const payload = take();
    if (!payload || payload.kind !== "opportunity") return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.createChildOpportunityPlan(token, childId, {
        opportunitySlug: payload.opportunitySlug,
        status: payload.status,
        targetYear: payload.targetYear,
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
          <Text style={styles.cardTitle}>
            {titles[item.opportunitySlug] ??
              item.opportunitySlug.toUpperCase()}
          </Text>
          <Text style={styles.cardMeta}>
            {statusLabel(item.status)}
            {item.targetYear ? ` · ${item.targetYear}` : ""}
          </Text>
        </Pressable>
      ))}
      {items.length === 0 ? (
        <Text style={styles.empty}>
          Add an exam or opportunity from the catalogue.
        </Text>
      ) : null}
      <Pressable
        onPress={() => openForm()}
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
      >
        <Text style={styles.addBtnText}>+ Add an exam</Text>
      </Pressable>
      {undo && undo.kind === "opportunity" ? (
        <Pressable onPress={() => void restoreUndo()} style={styles.undo}>
          <Text style={styles.undoText}>
            Undo remove ·{" "}
            {titles[undo.opportunitySlug] ??
              undo.opportunitySlug.toUpperCase()}
          </Text>
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
