import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { listingPriceLabel } from "@/lib/market-display";
import { api, type Listing } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function MyListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setListings(await api.getMyListings(token));
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function updateStatus(listing: Listing, status: string) {
    try {
      const token = await getToken();
      if (!token) return;
      await api.updateListing(token, listing.id, { status });
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update");
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading your listings" />;
  }

  return (
    <FlatList
      style={styles.container}
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
          title="No listings yet"
          message="Post books, uniforms, or gear your community can reuse."
          actionLabel="Post a listing"
          onAction={() => router.push("/(app)/market/new")}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() =>
            router.push({
              pathname: "/(app)/market/[id]",
              params: { id: item.id },
            })
          }
        >
          <View style={styles.cardMain}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{listingPriceLabel(item)}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
          {item.status === "active" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${item.title} completed`}
              style={styles.actionBtn}
              onPress={() =>
                Alert.alert("Mark completed?", "This removes it from discovery.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Completed",
                    onPress: () => updateStatus(item, "completed"),
                  },
                ])
              }
            >
              <Text style={styles.actionText}>Done</Text>
            </Pressable>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  cardMain: { flex: 1 },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  price: {
    ...typography.supporting,
    color: colors.navy,
    fontFamily: typography.bold,
    marginTop: 2,
  },
  status: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
    textTransform: "capitalize",
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    minHeight: 44,
    justifyContent: "center",
  },
  actionText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
    fontSize: 13,
  },
});
