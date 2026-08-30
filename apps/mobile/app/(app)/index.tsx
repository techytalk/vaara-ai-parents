import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FeedPostCard } from "@/components/feed/FeedPostCard";
import { EmptyState, Avatar, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannels } from "@/hooks/useRealtimeChannels";
import { api, type AuthUser, type Circle, type HomeFeedPost } from "@/lib/api";
import {
  composeParamsForMode,
  pickPrimaryCircle,
  type ComposeMode,
} from "@/lib/home-feed";
import { getToken } from "@/lib/session";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

  const loadMeta = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return null;
    }
    const [me, circleList, notifications, saved] = await Promise.all([
      api.me(token),
      api.getCircles(token),
      api.getNotifications(token).catch(() => []),
      api.getSaved(token).catch(() => ({ posts: [] })),
    ]);
    if (!me.onboardingComplete) {
      router.replace("/onboarding/children");
      return null;
    }
    setUser(me);
    setCircles(circleList);
    setUnreadAlerts(notifications.filter((item) => !item.readAt).length);
    setSavedPostIds(new Set(saved.posts.map((post) => post.id)));
    return token;
  }, [router]);

  const feedQuery = useInfiniteQuery({
    queryKey: ["homeFeed"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      if (!pageParam) await loadMeta();
      return api.getHomeFeed(token, {
        cursor: pageParam,
        limit: 20,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [feedQuery.data]
  );

  const refreshFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
  }, [queryClient]);

  const circleChannels = useMemo(
    () => circles.map((circle) => `circle:${circle.id}`),
    [circles]
  );

  useRealtimeChannels({
    channels: circleChannels,
    enabled: circleChannels.length > 0,
    onEvent: (event) => {
      if (event.type === "post.new" || event.type === "reply.new") {
        refreshFeed();
      }
    },
    onPollFallback: refreshFeed,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Feed",
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={8}
          style={styles.bellBtn}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadAlerts > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadAlerts > 9 ? "9+" : unreadAlerts}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, router, unreadAlerts]);

  useFocusEffect(
    useCallback(() => {
      loadMeta();
      refreshFeed();
    }, [loadMeta, refreshFeed])
  );

  const primaryCircle = useMemo(() => pickPrimaryCircle(circles), [circles]);
  const loading = feedQuery.isLoading && posts.length === 0;

  function openNewPost(mode?: ComposeMode) {
    if (!primaryCircle) {
      router.push("/onboarding/children");
      return;
    }
    router.push({
      pathname: "/circles/[circleId]/new-post",
      params: {
        circleId: primaryCircle.id,
        title: primaryCircle.displayName,
        ...(mode ? composeParamsForMode(mode) : {}),
      },
    });
  }

  function openPost(post: HomeFeedPost) {
    router.push({
      pathname: "/circles/[circleId]/posts/[postId]",
      params: {
        circleId: post.circleId,
        postId: post.id,
        title: post.circleName,
      },
    });
  }

  function updatePostInCache(
    postId: string,
    updater: (post: HomeFeedPost) => HomeFeedPost
  ) {
    queryClient.setQueryData(
      ["homeFeed"],
      (current:
        | {
            pages: Array<{ posts: HomeFeedPost[]; nextCursor: string | null }>;
            pageParams: unknown[];
          }
        | undefined) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) =>
              post.id === postId ? updater(post) : post
            ),
          })),
        };
      }
    );
  }

  async function onPollVote(post: HomeFeedPost, optionId: string) {
    const token = await getToken();
    if (!token) return;
    try {
      const { poll } = await api.votePoll(
        token,
        post.circleId,
        post.id,
        optionId
      );
      if (!poll) return;
      updatePostInCache(post.id, (item) => ({ ...item, poll }));
    } catch {
      // ignore vote errors in feed
    }
  }

  async function toggleSave(postId: string) {
    const token = await getToken();
    if (!token) return;
    const isSaved = savedPostIds.has(postId);
    try {
      if (isSaved) {
        await api.unsaveItem(token, "post", postId);
        setSavedPostIds((current) => {
          const next = new Set(current);
          next.delete(postId);
          return next;
        });
      } else {
        await api.saveItem(token, { itemType: "post", itemId: postId });
        setSavedPostIds((current) => new Set(current).add(postId));
      }
    } catch {
      // ignore save errors in feed
    }
  }

  async function toggleHelpful(post: HomeFeedPost) {
    const token = await getToken();
    if (!token) return;
    try {
      const result = await api.togglePostHelpful(token, post.id);
      updatePostInCache(post.id, (item) => ({
        ...item,
        myHelpful: result.helpful,
        helpfulCount: result.helpfulCount,
      }));
    } catch {
      // ignore helpful errors in feed
    }
  }

  async function sharePost(post: HomeFeedPost) {
    const preview = post.body.trim() || post.poll?.question || "A parent post";
    try {
      await Share.share({
        message: `${preview}\n\n— via Vaara Parents (${post.circleName})`,
      });
    } catch {
      // user dismissed share sheet
    }
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.hero}>
        <Avatar
          handle={user?.anonymousHandle ?? "Parent"}
          avatarKey={user?.avatarKey}
          size={48}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>
            {greetingForHour(new Date().getHours())},
          </Text>
          <Text style={styles.heroHandle}>
            {user?.anonymousHandle ?? "Parent"} 👋
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        onPress={() => openNewPost()}
        style={styles.composeCard}
      >
        <Avatar
          handle={user?.anonymousHandle ?? "Parent"}
          avatarKey={user?.avatarKey}
          size={36}
        />
        <Text style={styles.composePlaceholder}>What&apos;s on your mind?</Text>
      </Pressable>

      <View style={styles.composeActions}>
        <Pressable
          style={styles.composeAction}
          onPress={() => openNewPost("photo")}
        >
          <Ionicons name="image-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.composeActionText}>Photo</Text>
        </Pressable>
        <Pressable
          style={styles.composeAction}
          onPress={() => openNewPost("poll")}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.composeActionText}>Poll</Text>
        </Pressable>
        <Pressable
          style={styles.composeAction}
          onPress={() => openNewPost("recommendation")}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={colors.primaryDark}
          />
          <Text style={styles.composeActionText}>Recommendation</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return <ScreenLoader label="Loading your feed" />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            tintColor={colors.primary}
            onRefresh={async () => {
              await loadMeta();
              await feedQuery.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? (
            <ActivityIndicator
              style={styles.footerLoader}
              color={colors.primary}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="newspaper-outline"
            title="No posts yet"
            message={
              circles.length > 0
                ? "Be the first to share something with parents in your circles."
                : "Complete your profile to join circles and see posts from other parents."
            }
            actionLabel={circles.length > 0 ? "Create post" : "Complete profile"}
            onAction={() => openNewPost()}
          />
        }
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            circleName={item.circleName}
            saved={savedPostIds.has(item.id)}
            onPress={() => openPost(item)}
            onComment={() => openPost(item)}
            onToggleSave={() => toggleSave(item.id)}
            onToggleHelpful={() => toggleHelpful(item)}
            onShare={() => sharePost(item)}
            onPollVote={(optionId) => onPollVote(item, optionId)}
          />
        )}
      />

      {primaryCircle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create post"
          onPress={() => openNewPost()}
          style={styles.fab}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Post</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + 72,
    flexGrow: 1,
  },
  footerLoader: { marginVertical: spacing.md },
  headerBlock: { marginBottom: spacing.md },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroCopy: { flex: 1 },
  greeting: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  heroHandle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  composeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  composePlaceholder: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    flex: 1,
  },
  composeActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  composeAction: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  composeActionText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  bellBtn: { marginRight: 8, position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    ...typography.supporting,
    color: "#fff",
    fontFamily: typography.bold,
  },
});
