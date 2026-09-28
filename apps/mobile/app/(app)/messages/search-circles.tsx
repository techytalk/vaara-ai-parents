import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, InlineError, SearchField } from "@/components/ui";
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { circleTypeIcon } from "@/lib/circle-icons";
import {
  api,
  type Circle,
  type CircleDirectoryItem,
  type GuestQuota,
} from "@/lib/api";
import { getToken } from "@/lib/session";

type Row =
  | { rowKey: string; kind: "section"; title: string }
  | (CircleDirectoryItem & { rowKey: string; kind: "circle" });

function typeLabel(type: string): string {
  return (
    CIRCLE_TYPE_LABELS[type as Circle["circleType"]] ??
    type.replace(/_/g, " ")
  );
}

export default function SearchCirclesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [yourGroups, setYourGroups] = useState<CircleDirectoryItem[]>([]);
  const [otherCircles, setOtherCircles] = useState<CircleDirectoryItem[]>([]);
  const [guestQuota, setGuestQuota] = useState<GuestQuota | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, cursor?: string | null) => {
    const token = await getToken();
    if (!token) return;
    const appending = Boolean(cursor);
    if (appending) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.searchMessagesCircles(token, {
        q: q.trim() || undefined,
        cursor: cursor || undefined,
        limit: 30,
      });
      if (appending) {
        setOtherCircles((prev) => [...prev, ...result.otherCircles]);
      } else {
        setYourGroups(result.yourGroups);
        setOtherCircles(result.otherCircles);
      }
      setGuestQuota(result.guestQuota);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not search");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [load, query]);

  const rows: Row[] = [];
  if (yourGroups.length > 0) {
    rows.push({ rowKey: "sec:yours", kind: "section", title: "Your groups" });
    for (const item of yourGroups) {
      rows.push({ ...item, rowKey: `m:${item.id}`, kind: "circle" });
    }
  }
  if (otherCircles.length > 0) {
    rows.push({
      rowKey: "sec:other",
      kind: "section",
      title: "Other circles",
    });
    for (const item of otherCircles) {
      rows.push({ ...item, rowKey: `g:${item.id}`, kind: "circle" });
    }
  }

  function openCircle(item: CircleDirectoryItem) {
    if (item.accessMode === "member") {
      router.push({
        pathname: "/(app)/messages/groups/[circleId]",
        params: { circleId: item.id, circleName: item.displayName },
      });
      return;
    }
    router.push({
      pathname: "/(app)/messages/ask/[circleId]",
      params: {
        circleId: item.id,
        circleName: item.displayName,
        circleType: item.circleType,
        subtitle: item.subtitle ?? "",
      },
    } as unknown as Href);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Search circles</Text>
        <View style={styles.backPad} />
      </View>

      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="School, area, curriculum, community"
          autoFocus
        />
      </View>

      {guestQuota ? (
        <Text style={styles.quota}>
          {guestQuota.remaining} of {guestQuota.limit} guest questions left today
        </Text>
      ) : null}

      {error ? <InlineError message={error} /> : null}

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.rowKey}
          contentContainerStyle={[
            styles.list,
            rows.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No circles found"
              message="Try a school name, pin code, curriculum, or community."
            />
          }
          onEndReached={() => {
            if (!nextCursor || loadingMore || loading) return;
            void load(query, nextCursor);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ marginVertical: spacing.md }}
                color={colors.primary}
              />
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === "section") {
              return <Text style={styles.section}>{item.title}</Text>;
            }
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => openCircle(item)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.icon}>
                  <Ionicons
                    name={circleTypeIcon(item.circleType)}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.main}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.accessMode === "member" ? "Your group · " : "Ask as guest · "}
                    {typeLabel(item.circleType)}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  back: { width: 40, alignItems: "flex-start" },
  backPad: { width: 40 },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.text,
  },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  quota: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: typography.semibold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    marginTop: 2,
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
