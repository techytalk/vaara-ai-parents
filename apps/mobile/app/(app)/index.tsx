import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FeedPostCard } from "@/components/feed/FeedPostCard";
import { EmptyState, Avatar, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannels } from "@/hooks/useRealtimeChannels";
import { api, type HomeFeedPost } from "@/lib/api";
import {
  composeParamsForMode,
  pickPrimaryCircle,
  type ComposeMode,
} from "@/lib/home-feed";
import { hasCompletedAppTour } from "@/lib/app-tour";
import {
  dismissCompletionPrompt,
  evaluateCompletionGaps,
  hrefForCompletionPrompt,
  pickActiveCompletionPrompt,
  type CompletionPromptCandidate,
} from "@/lib/completion-prompts";
import { trackEvent } from "@/lib/analytics";
import {
  endAuthenticatedSession,
  isUnauthorized,
} from "@/lib/authenticated-state";
import { setSavedPostId } from "@/lib/post-cache";
import { getToken, saveSession } from "@/lib/session";
import {
  clearOnboardingDraft,
  getOnboardingChildren,
  getOnboardingCircles,
  getOnboardingUser,
} from "@/lib/onboarding-draft";
import { sharePostLink } from "@/lib/share-post";
import { useSubmitReport } from "@/providers/ReportProvider";
import { CompletionPrompt } from "@/components/CompletionPrompt";
import { HomeTourOverlay, useHomeTour } from "@/components/tour/HomeTourOverlay";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const submitReport = useSubmitReport();
  const [draftSnapshot] = useState(() => ({
    user: getOnboardingUser(),
    circles: getOnboardingCircles(),
    children: getOnboardingChildren(),
  }));
  const [activePrompt, setActivePrompt] =
    useState<CompletionPromptCandidate | null>(null);
  const authExitStartedRef = useRef(false);

  useEffect(() => {
    clearOnboardingDraft();
  }, []);

  const feedQuery = useInfiniteQuery({
    queryKey: ["homeFeed"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return api.getHomeFeed(token, {
        cursor: pageParam,
        limit: 20,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });

  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [feedQuery.data]
  );

  const refreshFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
  }, [queryClient]);

  const userQuery = useQuery({
    queryKey: ["sessionUser"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const me = await api.me(token);
      await saveSession(token, me);
      return me;
    },
    initialData: draftSnapshot.user ?? undefined,
    enabled: feedQuery.isSuccess,
    retry: false,
  });
  const user = userQuery.data ?? null;

  const circlesQuery = useQuery({
    queryKey: ["circles"],
    queryFn: () => authed((token) => api.getCircles(token)),
    initialData: draftSnapshot.circles ?? undefined,
    enabled: feedQuery.isSuccess,
    retry: false,
  });
  const circles = circlesQuery.data ?? [];

  const notificationsQuery = useQuery({
    queryKey: ["me", "notifications"],
    queryFn: () => authed((token) => api.getNotifications(token)),
    enabled: feedQuery.isSuccess,
    retry: false,
  });
  const unreadAlerts =
    notificationsQuery.data?.filter((item) => !item.readAt).length ?? 0;

  const savedQuery = useQuery({
    queryKey: ["me", "savedPostIds"],
    queryFn: async () => {
      const result = await authed((token) => api.getSaved(token));
      return result.posts.map((post) => post.id);
    },
    enabled: feedQuery.isSuccess,
    retry: false,
  });
  const savedPostIds = useMemo(
    () => new Set(savedQuery.data ?? []),
    [savedQuery.data]
  );

  const childrenQuery = useQuery({
    queryKey: ["me", "children"],
    queryFn: () => authed((token) => api.getChildren(token)),
    initialData: draftSnapshot.children ?? undefined,
    enabled: feedQuery.isSuccess,
    retry: false,
  });

  useEffect(() => {
    const unauthorized = [
      feedQuery.error,
      userQuery.error,
      circlesQuery.error,
      notificationsQuery.error,
      savedQuery.error,
      childrenQuery.error,
    ].some(isUnauthorized);
    if (!unauthorized || authExitStartedRef.current) return;

    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }, [
    feedQuery.error,
    userQuery.error,
    circlesQuery.error,
    notificationsQuery.error,
    savedQuery.error,
    childrenQuery.error,
    router,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        !feedQuery.isSuccess ||
        !circlesQuery.isSuccess ||
        !childrenQuery.isSuccess
      ) {
        setActivePrompt(null);
        return;
      }
      if (!(await hasCompletedAppTour())) {
        if (!cancelled) setActivePrompt(null);
        return;
      }
      const gaps = evaluateCompletionGaps({
        children: childrenQuery.data ?? [],
        circles: circlesQuery.data ?? [],
      });
      const prompt = await pickActiveCompletionPrompt(gaps);
      if (!cancelled) setActivePrompt(prompt);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    feedQuery.isSuccess,
    childrenQuery.data,
    childrenQuery.isSuccess,
    circlesQuery.data,
    circlesQuery.isSuccess,
  ]);

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

  const primaryCircle = useMemo(() => pickPrimaryCircle(circles), [circles]);
  const loading = feedQuery.isLoading && posts.length === 0;
  const composeLocked = circlesQuery.isPending || circlesQuery.isError;
  const circlesKnown = circlesQuery.isSuccess;
  const hasCircles = circlesKnown && circles.length > 0;
  const tour = useHomeTour(
    !feedQuery.isLoading && Boolean(user) && circlesQuery.isSuccess
  );

  async function onDismissPrompt() {
    if (!activePrompt) return;
    const { count } = await dismissCompletionPrompt(activePrompt.key);
    trackEvent("completion_prompt_dismissed", {
      prompt: activePrompt.kind,
      dismissal_count: count,
    });
    setActivePrompt(null);
  }

  function onPressPrompt() {
    if (!activePrompt) return;
    const href = hrefForCompletionPrompt(activePrompt);
    router.push(href as never);
  }

  function openNewPost(mode?: ComposeMode) {
    if (circlesQuery.isPending || circlesQuery.isError) {
      return;
    }
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

  function reportPost(post: HomeFeedPost) {
    submitReport({
      title: "Report post",
      submit: async (reason) => {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        await api.reportPost(token, post.circleId, post.id, reason);
      },
    });
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
      } else {
        await api.saveItem(token, { itemType: "post", itemId: postId });
      }
      setSavedPostId(queryClient, postId, !isSaved);
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
    const token = await getToken();
    if (!token) return;
    try {
      await sharePostLink({
        token,
        circleId: post.circleId,
        postId: post.id,
        post,
        circleName: post.circleName,
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

      {activePrompt ? (
        <CompletionPrompt
          prompt={activePrompt}
          onPress={onPressPrompt}
          onDismiss={onDismissPrompt}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        disabled={composeLocked}
        onPress={() => openNewPost()}
        style={[styles.composeCard, composeLocked && styles.composeLocked]}
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
          style={[styles.composeAction, composeLocked && styles.composeLocked]}
          disabled={composeLocked}
          onPress={() => openNewPost("photo")}
        >
          <Ionicons name="image-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.composeActionText}>Photo</Text>
        </Pressable>
        <Pressable
          style={[styles.composeAction, composeLocked && styles.composeLocked]}
          disabled={composeLocked}
          onPress={() => openNewPost("poll")}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.composeActionText}>Poll</Text>
        </Pressable>
        <Pressable
          style={[styles.composeAction, composeLocked && styles.composeLocked]}
          disabled={composeLocked}
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

  if (loading || isUnauthorized(feedQuery.error)) {
    return <ScreenLoader label="Loading your feed" />;
  }

  if (feedQuery.isError) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your feed"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => {
            void feedQuery.refetch();
          }}
        />
      </View>
    );
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
              await Promise.all([
                feedQuery.refetch(),
                userQuery.refetch(),
                circlesQuery.refetch(),
                notificationsQuery.refetch(),
                savedQuery.refetch(),
                childrenQuery.refetch(),
              ]);
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
              hasCircles
                ? "Be the first to share something with parents in your circles."
                : circlesKnown
                  ? "Complete your profile to join circles. We'll also suggest posts from other parent groups nearby."
                  : "Posts from your circles will show up here."
            }
            actionLabel={
              hasCircles
                ? "Create post"
                : circlesKnown
                  ? "Complete profile"
                  : undefined
            }
            onAction={
              hasCircles || circlesKnown ? () => openNewPost() : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            circleId={item.circleId}
            circleName={item.circleName}
            discovery={item.discovery}
            saved={savedPostIds.has(item.id)}
            onPress={() => openPost(item)}
            onComment={() => openPost(item)}
            onToggleSave={
              savedQuery.isSuccess ? () => toggleSave(item.id) : undefined
            }
            onToggleHelpful={
              item.discovery ? undefined : () => toggleHelpful(item)
            }
            onShare={() => sharePost(item)}
            onPollVote={
              item.discovery ? undefined : (optionId) => onPollVote(item, optionId)
            }
            onReport={
              user && (item.authorId ?? item.author.userId) !== user.id
                ? () => reportPost(item)
                : undefined
            }
          />
        )}
      />

      {primaryCircle && !tour.visible ? (
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

      <HomeTourOverlay
        visible={tour.visible}
        circles={circles}
        onFinished={tour.dismiss}
      />
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
  composeLocked: { opacity: 0.5 },
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
