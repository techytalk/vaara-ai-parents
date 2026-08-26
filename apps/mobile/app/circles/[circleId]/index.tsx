import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthorRow,
  cardShadow,
  EmptyState,
  formatPostTime,
  PostMediaGallery,
  PostTagBadge,
  ScreenLoader,
  theme,
} from "@/components/circles/ui";
import { api, type CirclePost } from "@/lib/api";
import { getToken } from "@/lib/session";

function PostCard({
  post,
  onPress,
}: {
  post: CirclePost;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.postCard, cardShadow()]}
      onPress={onPress}
    >
      <AuthorRow
        handle={post.author.anonymousHandle}
        contextLabel={post.author.contextLabel}
        timestamp={post.createdAt}
      />
      <View style={styles.postBody}>
        <PostTagBadge tag={post.tag} />
        {post.body ? <Text style={styles.postText}>{post.body}</Text> : null}
      </View>
      <PostMediaGallery media={post.media ?? []} />
      <View style={styles.postFooter}>
        <View style={styles.footerStat}>
          <Ionicons
            name="chatbubble-outline"
            size={14}
            color={theme.textMuted}
          />
          <Text style={styles.footerStatText}>
            {post.replyCount === 0
              ? "Reply"
              : `${post.replyCount} repl${post.replyCount === 1 ? "y" : "ies"}`}
          </Text>
        </View>
        <Text style={styles.footerTime}>{formatPostTime(post.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function CircleFeedScreen() {
  const { circleId, title } = useLocalSearchParams<{
    circleId: string;
    title?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? "Circle",
    });
  }, [navigation, title]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const [feed, members] = await Promise.all([
      api.getCircleFeed(token, circleId, { scope: "local" }),
      api.getCircleMembers(token, circleId),
    ]);
    setPosts(feed.posts);
    setMemberCount(members.length);
  }, [circleId]);

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

  function openNewPost() {
    router.push({
      pathname: "/circles/[circleId]/new-post",
      params: { circleId, title },
    });
  }

  function openMembers() {
    router.push({
      pathname: "/circles/[circleId]/members",
      params: { circleId, title },
    });
  }

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.hero, cardShadow()]}>
        <Text style={styles.heroTitle}>{title ?? "Your circle"}</Text>
        <Text style={styles.heroSubtitle}>
          Anonymous posts from parents in this circle
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="document-text-outline" size={14} color={theme.primary} />
            <Text style={styles.statText}>
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Pressable style={styles.statChip} onPress={openMembers}>
            <Ionicons name="people-outline" size={14} color={theme.primary} />
            <Text style={styles.statText}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryAction} onPress={openMembers}>
          <Ionicons name="people-outline" size={18} color={theme.primary} />
          <Text style={styles.secondaryActionText}>Members</Text>
        </Pressable>
        <Pressable style={styles.primaryAction} onPress={openNewPost}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.primaryActionText}>New post</Text>
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={
          posts.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No posts yet"
            subtitle="Be the first to ask a question or share a tip with parents in this circle."
            actionLabel="Start a post"
            onAction={openNewPost}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() =>
              router.push({
                pathname: "/circles/[circleId]/posts/[postId]",
                params: { circleId, postId: item.id, title },
              })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  hero: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primary,
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.primary,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  postCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  postBody: {
    marginTop: 14,
    gap: 10,
  },
  postText: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 24,
  },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerStatText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textMuted,
  },
  footerTime: {
    fontSize: 12,
    color: theme.textMuted,
  },
});
