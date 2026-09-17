import { useCallback, useMemo, useState } from "react";
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
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, InlineError, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, type ChatHomeItem } from "@/lib/api";
import { getToken } from "@/lib/session";
import { formatPostTime } from "@/components/circles/ui";

async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

export function ChatHomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["chatHome"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      authed((token) =>
        api.getChatHome(token, { cursor: pageParam, limit: 20 })
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const meQuery = useQuery({
    queryKey: ["sessionUser"],
    queryFn: () => authed((token) => api.me(token)),
  });

  useRealtimeChannel({
    channel: meQuery.data?.id ? `user:${meQuery.data.id}:inbox` : null,
    onEvent: (event) => {
      if (event.type === "inbox.updated" || event.type === "chat.message") {
        void query.refetch();
      }
    },
    onPollFallback: () => {
      void query.refetch();
    },
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const threadIds = useMemo(
    () => items.filter((item) => item.kind === "thread").map((item) => item.id),
    [items]
  );

  const onView = useCallback(() => {
    if (threadIds.length === 0) return;
    void authed((token) =>
      api.recordChatHomeImpressions(token, { threadIds })
    ).catch(() => {});
  }, [threadIds]);

  if (query.isLoading) {
    return <ScreenLoader label="Loading Home" />;
  }

  if (query.isError && items.length === 0) {
    return (
      <View style={styles.error}>
        <InlineError
          message="We couldn't load Home. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      onLayout={onView}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={onRefresh}
        />
      }
      contentContainerStyle={[
        styles.list,
        items.length === 0 && styles.empty,
      ]}
      ListHeaderComponent={
        <Text style={styles.intro}>
          Conversations from your groups. Tap a row to open that thread.
        </Text>
      }
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title="Start a conversation"
          message="Ask something in one of your groups. Lasting questions stay here. If your groups are quiet, we also show relevant threads from nearby parents."
        />
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
        ) : null
      }
      renderItem={({ item }) => (
        <HomeRow
          item={item}
          onPress={() => {
            if (item.kind === "service" && item.providerId) {
              router.push({
                pathname: "/(app)/messages/channels/[providerId]",
                params: { providerId: item.providerId },
              });
              return;
            }
            router.push({
              pathname: "/(app)/messages/threads/[threadId]",
              params: { threadId: item.id },
            });
          }}
        />
      )}
    />
  );
}

function HomeRow({
  item,
  onPress,
}: {
  item: ChatHomeItem;
  onPress: () => void;
}) {
  const isService = item.kind === "service";
  const title = isService
    ? item.name ?? "Tutor"
    : item.title || item.body || "Thread";
  const subtitle = isService
    ? item.preview ?? "Services"
    : item.circleName ?? "Group";
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.icon,
          { backgroundColor: isService ? colors.warningSoft : colors.primarySoft },
        ]}
      >
        <Ionicons
          name={isService ? "briefcase-outline" : "chatbubble-ellipses-outline"}
          size={20}
          color={isService ? colors.warning : colors.primaryDark}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.topline}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {item.lastMessageAt ? (
            <Text style={styles.time}>{formatPostTime(item.lastMessageAt)}</Text>
          ) : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>
          {item.access === "discovery" ? "Guest preview · " : ""}
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  empty: { flexGrow: 1 },
  intro: {
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  topline: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: {
    flex: 1,
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 16,
  },
  time: { fontFamily: typography.regular, color: colors.textSubtle, fontSize: 12 },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 13,
  },
});
