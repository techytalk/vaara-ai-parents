import { useEffect, useRef } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { authed, endAuthenticatedSession, isUnauthorized } from "@/lib/authenticated-state";

export default function YourPostsScreen() {
  const router = useRouter();
  const authExitStartedRef = useRef(false);
  const myPostsQuery = useQuery({
    queryKey: ["myPosts"],
    queryFn: () => authed((token) => api.getMyPosts(token).then((r) => r.posts)),
    retry: false,
  });

  useEffect(() => {
    if (!isUnauthorized(myPostsQuery.error) || authExitStartedRef.current) {
      return;
    }
    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }, [myPostsQuery.error, router]);

  const posts = myPostsQuery.data ?? [];

  if (myPostsQuery.isLoading && posts.length === 0) {
    return <ScreenLoader label="Loading your posts" />;
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={myPostsQuery.isRefetching && !myPostsQuery.isLoading}
          tintColor={colors.primary}
          onRefresh={() => {
            void myPostsQuery.refetch();
          }}
        />
      }
      contentContainerStyle={
        posts.length === 0 ? styles.emptyContainer : styles.list
      }
      ListEmptyComponent={
        <EmptyState
          icon="create-outline"
          title="No posts yet"
          message="Posts you write, including questions to a school you are not in, will appear here."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open post in ${item.circleName}`}
          onPress={() =>
            router.push({
              pathname: "/circles/[circleId]/posts/[postId]",
              params: { circleId: item.circleId, postId: item.id },
            })
          }
        >
          <Text style={styles.circle}>
            {item.targets && item.targets.length > 1
              ? item.targets.map((t) => t.circleName).join(" · ")
              : item.circleName}
          </Text>
          {item.accessState === "author" ||
          item.postingContext === "guest" ||
          item.targets?.some((t) => t.accessMode === "guest") ? (
            <Text style={styles.badge}>
              {item.targets && item.targets.length > 1
                ? "Posted across circles · shared thread"
                : "Guest · Not in this circle"}
            </Text>
          ) : null}
          <Text style={styles.body} numberOfLines={3}>
            {item.body || "Poll"}
          </Text>
          <Text style={styles.meta}>
            {item.replyCount} {item.replyCount === 1 ? "reply" : "replies"}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  circle: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
    marginBottom: 4,
  },
  badge: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.amber,
    marginBottom: 6,
  },
  body: {
    fontFamily: typography.regular,
    color: colors.text,
    lineHeight: 20,
  },
  meta: {
    marginTop: 8,
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
});
