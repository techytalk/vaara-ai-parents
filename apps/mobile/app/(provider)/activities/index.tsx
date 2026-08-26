import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Activity } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ProviderActivitiesList() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getProviderActivities(token);
    setActivities(list);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
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
      <Pressable
        style={styles.createBtn}
        onPress={() => router.push("/(provider)/activities/new")}
      >
        <Text style={styles.createBtnText}>+ New activity</Text>
      </Pressable>

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
          <Text style={styles.empty}>No activities yet. Create your first one.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/(provider)/activities/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.status}>{item.status}</Text>
            <Text style={styles.meta}>
              Pins: {item.pinCodes.join(", ")}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  createBtn: {
    margin: 12,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  createBtnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#5c5c7a", padding: 24 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#1a1a2e" },
  status: {
    fontSize: 12,
    color: "#4f46e5",
    marginTop: 4,
    textTransform: "capitalize",
  },
  meta: { fontSize: 13, color: "#5c5c7a", marginTop: 6 },
});
