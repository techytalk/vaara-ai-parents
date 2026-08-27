import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { AuthorRow, formatPostTime, theme } from "@/components/circles/ui";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, type CirclePost } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function TopicFeedScreen() {
  const { slug, title } = useLocalSearchParams<{ slug: string; title?: string }>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: title ?? slug });
  }, [navigation, slug, title]);

  const feedQuery = useQuery({
    queryKey: ["topicFeed", slug],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [feed, followed] = await Promise.all([
        api.getTopicFeed(token, slug),
        api.getFollowedTopics(token),
      ]);
      return {
        posts: feed.posts,
        following: followed.some((topic) => topic.slug === slug),
      };
    },
  });

  const refreshFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["topicFeed", slug] });
  }, [queryClient, slug]);

  useRealtimeChannel({
    channel: slug ? `topic:${slug}` : null,
    onEvent: (event) => {
      if (event.type === "post.new") {
        refreshFeed();
      }
    },
    onPollFallback: refreshFeed,
  });

  const posts = feedQuery.data?.posts ?? [];
  const following = feedQuery.data?.following ?? false;
  const loading = feedQuery.isLoading;

  async function toggleFollow() {
    const token = await getToken();
    if (!token) return;
    if (following) {
      await api.unfollowTopic(token, slug);
    } else {
      await api.followTopic(token, slug);
    }
    refreshFeed();
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
      <Pressable style={styles.followBtn} onPress={toggleFollow}>
        <Text style={styles.followBtnText}>
          {following ? "Following" : "Follow topic"}
        </Text>
      </Pressable>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await feedQuery.refetch();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No posts yet in circles you belong to. Tag posts with this topic when
            you share.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <AuthorRow
              handle={item.author.anonymousHandle}
              contextLabel={item.author.contextLabel}
              timestamp={item.createdAt}
            />
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{formatPostTime(item.createdAt)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  followBtn: {
    margin: 12,
    alignSelf: "flex-start",
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  followBtnText: { color: theme.primary, fontWeight: "700" },
  list: { padding: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: theme.textMuted, lineHeight: 22 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  body: { fontSize: 15, color: theme.text, marginTop: 10, lineHeight: 22 },
  time: { fontSize: 12, color: theme.textMuted, marginTop: 8 },
});
