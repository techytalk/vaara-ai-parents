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
import { api, type AppNotification } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getNotifications(token);
    setItems(list);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function onPressItem(item: AppNotification) {
    const token = await getToken();
    if (!token) return;
    if (!item.readAt) {
      await api.markNotificationRead(token, item.id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    }

    const data = item.data;
    if (item.type === "direct_message" && data.conversationId) {
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: { conversationId: String(data.conversationId) },
      });
    } else if (item.type === "circle_post" && data.circleId) {
      router.push({
        pathname: "/circles/[circleId]",
        params: { circleId: String(data.circleId) },
      });
    } else if (data.activityId) {
      router.push({
        pathname: "/(app)/activities/[id]",
        params: { id: String(data.activityId) },
      });
    }
  }

  async function onMarkAllRead() {
    const token = await getToken();
    if (!token) return;
    await api.markAllNotificationsRead(token);
    await load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.markAll} onPress={onMarkAllRead}>
        <Text style={styles.markAllText}>Mark all read</Text>
      </Pressable>

      <FlatList
        data={items}
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
          <Text style={styles.empty}>No notifications yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, !item.readAt && styles.rowUnread]}
            onPress={() => onPressItem(item)}
          >
            <Text style={styles.title}>{item.title}</Text>
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString()}
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
  markAll: { padding: 12, alignItems: "flex-end" },
  markAllText: { color: "#4f46e5", fontWeight: "600" },
  empty: { textAlign: "center", color: "#5c5c7a", padding: 24 },
  row: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  rowUnread: { borderColor: "#c7d2fe", backgroundColor: "#f5f3ff" },
  title: { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  body: { fontSize: 14, color: "#5c5c7a", marginTop: 4 },
  time: { fontSize: 12, color: "#9ca3af", marginTop: 6 },
});
