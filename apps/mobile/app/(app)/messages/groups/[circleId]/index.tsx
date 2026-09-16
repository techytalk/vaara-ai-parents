import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChatThreadScreen } from "@/components/chat/ChatThreadScreen";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function GroupScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: ["groupThreads", circleId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return api.getGroupThreads(token, String(circleId));
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  if (query.isLoading) return <ScreenLoader label="Loading group" />;
  if (query.data?.linear) {
    return <ChatThreadScreen mode="group" circleId={String(circleId)} />;
  }

  const threads = query.data?.threads ?? [];
  return (
    <View style={styles.screen}>
      <Pressable
        style={styles.cta}
        onPress={() =>
          router.push({
            pathname: "/(app)/messages/groups/[circleId]/new-thread",
            params: { circleId: String(circleId) },
          })
        }
      >
        <Text style={styles.ctaLabel}>Start a thread</Text>
      </Pressable>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No threads yet"
            message="Start a topic so replies stay together."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/(app)/messages/threads/[threadId]",
                params: { threadId: item.id },
              })
            }
          >
            <Text style={styles.title} numberOfLines={2}>
              {item.title || item.body || "Thread"}
            </Text>
            <Text style={styles.meta}>
              {item.replyCount} replies{item.unread ? " · new" : ""}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  ctaLabel: { fontFamily: typography.semibold, color: colors.textInverse },
  row: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: typography.semibold, color: colors.text, fontSize: 16 },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
});
