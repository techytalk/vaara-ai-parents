import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
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

function priceLabel(listing: Listing) {
  if (listing.kind === "free") return "Free";
  if (listing.kind === "wanted") return "Wanted";
  if (listing.priceAmount != null) {
    return `₹${listing.priceAmount.toLocaleString("en-IN")}`;
  }
  return "Price on request";
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
          <Pressable onPress={() => router.push("/(app)/market/mine")} hitSlop={8}>
            <Text style={styles.headerLink}>Mine</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(app)/market/new")} hitSlop={8}>
            <Ionicons name="add-circle" size={26} color={colors.primary} />
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scopeRow}>
        <Pressable
          style={[styles.scopeChip, scope === "community" && styles.scopeChipActive]}
          onPress={() => setScope("community")}
        >
          <Text
            style={[
              styles.scopeChipText,
              scope === "community" && styles.scopeChipTextActive,
            ]}
          >
            My community
          </Text>
        </Pressable>
        <Pressable
          style={[styles.scopeChip, scope === "pin" && styles.scopeChipActive]}
          onPress={() => setScope("pin")}
        >
          <Text
            style={[
              styles.scopeChipText,
              scope === "pin" && styles.scopeChipTextActive,
            ]}
          >
            Pin code
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search listings…"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load()}
        returnKeyType="search"
      />

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.value || "all"}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryContent}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.categoryChip,
              category === item.value && styles.categoryChipActive,
            ]}
            onPress={() => setCategory(item.value)}
          >
            <Text
              style={[
                styles.categoryChipText,
                category === item.value && styles.categoryChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={
          listings.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No listings nearby yet. Be the first to post something your community
            can reuse.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
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
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text
                style={[
                  styles.price,
                  item.kind === "free" && styles.priceFree,
                ]}
              >
                {priceLabel(item)}
              </Text>
              <Text style={styles.meta}>{item.category.replace("_", " ")}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14, marginRight: 4 },
  headerLink: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  scopeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  scopeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  scopeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  scopeChipText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  scopeChipTextActive: { color: colors.primary },
  search: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  categoryList: { maxHeight: 44, marginTop: 10 },
  categoryContent: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  categoryChipTextActive: { color: "#fff" },
  error: { color: "#dc2626", paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, paddingTop: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: colors.textMuted, lineHeight: 22 },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 96, height: 96 },
  thumbPlaceholder: {
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: { flex: 1, padding: 12, justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 20 },
  price: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },
  priceFree: { color: "#047857" },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4, textTransform: "capitalize" },
});
