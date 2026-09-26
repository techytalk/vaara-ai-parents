import { useEffect, useRef } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Avatar, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useOriginBackHeader } from "@/hooks/useOriginBack";
import { api } from "@/lib/api";
import { authed, endAuthenticatedSession, isUnauthorized } from "@/lib/authenticated-state";

export default function SavedScreen() {
  useOriginBackHeader();
  const router = useRouter();
  const authExitStartedRef = useRef(false);
  const savedPostsQuery = useQuery({
    queryKey: ["me", "savedPosts"],
    queryFn: () => authed((token) => api.getSaved(token).then((r) => r.posts)),
    retry: false,
  });

  useEffect(() => {
    if (!isUnauthorized(savedPostsQuery.error) || authExitStartedRef.current) {
      return;
    }
    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }, [savedPostsQuery.error, router]);

  const posts = savedPostsQuery.data ?? [];

  if (savedPostsQuery.isLoading && posts.length === 0) {
    return <ScreenLoader label="Loading saved posts" />;
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={savedPostsQuery.isRefetching && !savedPostsQuery.isLoading}
          tintColor={colors.primary}
          onRefresh={() => {
            void savedPostsQuery.refetch();
          }}
        />
      }
      contentContainerStyle={
        posts.length === 0 ? styles.emptyContainer : styles.list
      }
      ListEmptyComponent={
        <EmptyState
          icon="bookmark-outline"
          title="No saved posts"
          message="Tap the bookmark on a circle post to save helpful advice here."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          disabled={item.unavailable || !item.circleId}
          accessibilityRole="button"
          accessibilityLabel={
            item.unavailable
              ? "Saved post unavailable"
              : `Saved post by ${item.authorHandle}`
          }
          onPress={() => {
            if (!item.circleId) return;
            router.push({
              pathname: "/circles/[circleId]/posts/[postId]",
              params: { circleId: item.circleId, postId: item.id },
            });
          }}
        >
          {item.unavailable ? (
            <Text style={styles.unavailable}>
              This post is no longer available
            </Text>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <Avatar
                  handle={item.authorHandle ?? "Parent"}
                  avatarKey={item.authorAvatarKey}
                  size={32}
                />
                <Text style={styles.handle}>{item.authorHandle ?? "Parent"}</Text>
              </View>
              <Text style={styles.body} numberOfLines={4}>
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
  list: { padding: spacing.lg },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  handle: {
    ...typography.supporting,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  body: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    lineHeight: 22,
  },
  unavailable: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    fontStyle: "italic",
  },
});
