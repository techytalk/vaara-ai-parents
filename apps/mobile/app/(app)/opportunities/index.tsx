import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useOriginBackHeader } from "@/hooks/useOriginBack";
import { ApiError, api, type OpportunityCard } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";

function isOffline(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  const message = error instanceof Error ? error.message : "";
  return /network|internet|offline|failed to fetch|network request failed/i.test(
    message
  );
}

export default function CompetitiveExamsScreen() {
  useOriginBackHeader();
  const router = useRouter();
  const params = useLocalSearchParams<{ childId?: string; segment?: string }>();
  const childId = typeof params.childId === "string" ? params.childId : undefined;
  const [segment, setSegment] = useState<"all" | "suggested">(
    params.segment === "suggested" && childId ? "suggested" : "all"
  );
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<OpportunityCard[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const result = await api.listOpportunities(token, {
        childId,
        q: query.trim() || undefined,
        segment: childId ? segment : "all",
      });
      setEnabled(result.enabled);
      setItems(result.items);
      setError(null);
      trackEvent("opportunity_list_viewed", {
        surface: "competitive_exams",
        segment,
        count: result.items.length,
      });
    } catch (e) {
      setError(
        isOffline(e)
          ? "No network. Connect to the internet and try again."
          : e instanceof Error
            ? e.message
            : "Could not load exams"
      );
    }
  }, [childId, query, router, segment]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && items.length === 0 && !error) {
    return <ScreenLoader />;
  }

  return (
    <View style={styles.screen}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void onRefresh()}
        placeholder="Search exams"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCorrect={false}
        returnKeyType="search"
      />
      {childId ? (
        <View style={styles.segments}>
          {(["suggested", "all"] as const).map((key) => {
            const on = segment === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  trackEvent("opportunity_filter_changed", { segment: key });
                  setSegment(key);
                }}
                style={[styles.segment, on && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                  {key === "suggested" ? "For this class" : "All"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!enabled ? (
        <EmptyState
          title="Not available yet"
          message="Competitive exams will show here once the catalogue is published."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No exams yet"
              message="No verified listings match these filters yet."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(app)/opportunities/[slug]",
                  params: { slug: item.slug, ...(childId ? { childId } : {}) },
                })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {[
                  item.organizerName,
                  item.edition?.editionLabel,
                  item.registrationState?.replace(/_/g, " "),
                  item.kind,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {item.edition?.eligibilitySummary ? (
                <Text style={styles.eligibility} numberOfLines={2}>
                  {item.edition.eligibilitySummary}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.regular,
    color: colors.text,
  },
  segments: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: typography.regular, color: colors.text },
  segmentTextOn: { color: colors.textInverse, fontFamily: typography.bold },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  emptyList: { flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: typography.bold, fontSize: 16, color: colors.text },
  meta: {
    marginTop: 4,
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 13,
  },
  eligibility: {
    marginTop: 6,
    fontFamily: typography.regular,
    color: colors.text,
    fontSize: 13,
  },
  error: {
    color: colors.error,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.regular,
  },
});
