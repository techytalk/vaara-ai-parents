import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Chip,
  EmptyState,
  InlineError,
  ScreenLoader,
  SearchField,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { listingKindLabel, listingPriceLabel } from "@/lib/market-display";
import { api, type Listing } from "@/lib/api";
import { getToken } from "@/lib/session";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "textbooks", label: "Books" },
  { value: "uniforms", label: "Uniforms" },
  { value: "sports", label: "Sports" },
  { value: "toys", label: "Toys" },
  { value: "other", label: "Other" },
];

function kindAccent(kind: Listing["kind"]) {
  if (kind === "free") return colors.teal;
  if (kind === "wanted") return colors.lavender;
  return colors.coral;
}

export default function MarketScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [scope, setScope] = useState<"community" | "pin">("community");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My listings"
            onPress={() => router.push("/(app)/market/mine")}
            hitSlop={8}
          >
            <Text style={styles.headerLink}>Mine</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a listing"
            onPress={() => router.push("/(app)/market/new")}
            hitSlop={8}
          >
            <Ionicons name="add-circle" size={26} color={colors.coral} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, router]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.discoverListings(token, {
      scope,
      category: category || undefined,
      q: search.trim() || undefined,
    });
    setListings(list);
    setError(null);
  }, [scope, category, search]);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <ScreenLoader label="Loading community market" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Community Market</Text>
        <Text style={styles.introBody}>
          Sale, free, and wanted listings from parents in your community. Contact
          details are shared only after you agree in chat.
        </Text>
      </View>

      <View style={styles.scopeRow}>
        <Chip
          label="My community"
          selected={scope === "community"}
          onPress={() => setScope("community")}
        />
        <Chip
          label="Pin code"
          selected={scope === "pin"}
          onPress={() => setScope("pin")}
        />
      </View>

      <SearchField
        placeholder="Search listings…"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load()}
        returnKeyType="search"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((item) => (
          <Chip
            key={item.value || "all"}
            label={item.label}
            selected={category === item.value}
            onPress={() => setCategory(item.value)}
          />
        ))}
      </ScrollView>

      {error ? <InlineError message={error} onRetry={load} /> : null}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        contentContainerStyle={
          listings.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title="No listings nearby"
            message="Be the first to post something your community can reuse."
            actionLabel="Post a listing"
            onAction={() => router.push("/(app)/market/new")}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${listingPriceLabel(item)}`}
            onPress={() =>
              router.push({
                pathname: "/(app)/market/[id]",
                params: { id: item.id },
              })
            }
          >
            {item.media[0] ? (
              <Image source={{ uri: item.media[0].url }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.cardMain}>
              <View
                style={[
                  styles.kindBadge,
                  { backgroundColor: `${kindAccent(item.kind)}18` },
                ]}
              >
                <Text
                  style={[styles.kindBadgeText, { color: kindAccent(item.kind) }]}
                >
                  {listingKindLabel(item.kind)}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text
                style={[
                  styles.price,
                  item.kind === "free" && styles.priceFree,
                ]}
              >
                {listingPriceLabel(item)}
              </Text>
              <Text style={styles.meta}>{item.category.replace("_", " ")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginRight: spacing.xs,
  },
  headerLink: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  intro: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  introTitle: {
    ...typography.sectionTitle,
    color: colors.navy,
    fontFamily: typography.bold,
  },
  introBody: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  scopeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  categoryRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: { padding: spacing.lg, paddingTop: spacing.xs },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: spacing.sm,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  thumb: { width: 96, height: 96 },
  thumbPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: { flex: 1, padding: spacing.sm, justifyContent: "center" },
  kindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
    marginBottom: 4,
  },
  kindBadgeText: {
    ...typography.caption,
    fontFamily: typography.semibold,
    textTransform: "uppercase",
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    lineHeight: 20,
  },
  price: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    fontSize: 16,
    marginTop: 2,
  },
  priceFree: { color: colors.teal },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
