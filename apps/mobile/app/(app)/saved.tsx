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
import { colors } from "@/constants/theme";
import { api, type SavedPost } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function SavedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await api.getSaved(token);
    setPosts(data.posts);
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
    <FlatList
      style={styles.container}
      data={posts}
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
      contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No saved posts yet. Tap the bookmark on a circle post to save it here.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          disabled={item.unavailable || !item.circleId}
          onPress={() => {
            if (!item.circleId) return;
            router.push({
              pathname: "/circles/[circleId]/posts/[postId]",
              params: { circleId: item.circleId, postId: item.id },
            });
          }}
        >
          {item.unavailable ? (
            <Text style={styles.unavailable}>This post is no longer available</Text>
          ) : (
            <>
              <Text style={styles.handle}>{item.authorHandle}</Text>
              <Text style={styles.body} numberOfLines={3}>
                {item.body}
              </Text>
            </>
          )}
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
  empty: { textAlign: "center", color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: { fontSize: 13, fontWeight: "600", color: colors.primary, marginBottom: 6 },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  unavailable: { fontSize: 14, color: colors.textMuted, fontStyle: "italic" },
});
