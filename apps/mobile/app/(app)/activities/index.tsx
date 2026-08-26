import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Activity } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ParentActivitiesScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.discoverActivities(token, {
      q: search.trim() || undefined,
      verifiedOnly,
    });
    setActivities(list);
    setError(null);
  }, [search, verifiedOnly]);

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
      <TextInput
        style={styles.search}
        placeholder="Search activities…"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load()}
      />

      <Pressable
        style={[styles.filterChip, verifiedOnly && styles.filterChipActive]}
        onPress={() => setVerifiedOnly((current) => !current)}
      >
        <Text
          style={[
            styles.filterChipText,
            verifiedOnly && styles.filterChipTextActive,
          ]}
        >
          Verified only
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={activities}
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            No activities in your area yet. Check back when providers post nearby.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/(app)/activities/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.org}>
              {item.provider?.orgName}
              {item.provider?.verified ? " · Verified" : ""}
            </Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.provider?.ratingAvg != null ? (
              <Text style={styles.rating}>
                {item.provider.ratingAvg.toFixed(1)} ★ (
                {item.provider.ratingCount} reviews)
              </Text>
            ) : null}
            {item.feeAmount != null && (
              <Text style={styles.fee}>
                ₹{item.feeAmount} {item.feeCurrency}
              </Text>
            )}
            {item.locationText ? (
              <Text style={styles.meta}>{item.locationText}</Text>
            ) : null}
            <Text style={styles.meta}>Pin: {item.pinCodes.join(", ")}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  search: {
    margin: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  filterChip: {
    alignSelf: "flex-start",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e4ef",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  filterChipText: { fontSize: 13, color: "#5c5c7a", fontWeight: "600" },
  filterChipTextActive: { color: "#4f46e5" },
  error: { color: "#dc2626", paddingHorizontal: 12 },
  empty: { textAlign: "center", color: "#5c5c7a", padding: 24, lineHeight: 22 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  org: { fontSize: 13, color: "#4f46e5", fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", color: "#1a1a2e", marginTop: 4 },
  rating: { fontSize: 13, color: "#047857", marginTop: 4, fontWeight: "600" },
  fee: { fontSize: 14, color: "#1a1a2e", marginTop: 6 },
  meta: { fontSize: 13, color: "#5c5c7a", marginTop: 4 },
});
