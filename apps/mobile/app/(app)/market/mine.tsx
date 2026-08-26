import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
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
        <Text style={styles.empty}>You haven't posted any listings yet.</Text>
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
          <View style={styles.cardMain}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
          {item.status === "active" ? (
            <Pressable
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: colors.textMuted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  status: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: "capitalize",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  actionText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
