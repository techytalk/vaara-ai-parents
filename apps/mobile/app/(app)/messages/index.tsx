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
import { api, peerDisplayName, type ConversationPreview } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function MessagesInboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getConversations(token);
    setConversations(list);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
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
      data={conversations}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={
        conversations.length === 0 ? styles.emptyContainer : undefined
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          No messages yet. Message a parent from a circle member list or post
          thread.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: "/(app)/messages/[conversationId]",
              params: {
                conversationId: item.id,
                peerHandle: peerDisplayName(item.peer),
              },
            })
          }
        >
          <View style={styles.rowMain}>
            <Text style={styles.handle}>{peerDisplayName(item.peer)}</Text>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage?.body ?? "Start chatting"}
            </Text>
          </View>
          {item.unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: "#5c5c7a", fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  rowMain: { flex: 1 },
  handle: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  preview: { fontSize: 14, color: "#5c5c7a", marginTop: 4 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4f46e5",
    marginLeft: 8,
  },
});
