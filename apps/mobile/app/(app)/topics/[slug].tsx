import { useCallback, useLayoutEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { AuthorRow, formatPostTime } from "@/components/circles/ui";
import { Button, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api } from "@/lib/api";
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
    return <ScreenLoader label="Loading topic feed" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.followRow}>
        <Button
          label={following ? "Following" : "Follow topic"}
          variant={following ? "secondary" : "primary"}
          onPress={toggleFollow}
        />
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await feedQuery.refetch();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={[
          styles.list,
          posts.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No posts yet"
            message="Tag posts with this topic when you share in your circles. Follow to get digest updates."
          />
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
  container: { flex: 1, backgroundColor: colors.bg },
  followRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: { padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.xs },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
    lineHeight: 22,
    fontFamily: typography.regular,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontFamily: typography.regular,
  },
});
