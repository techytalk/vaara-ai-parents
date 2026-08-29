import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPostTime } from "@/components/circles/ui";
import { Avatar, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, peerDisplayName, type ConversationPreview } from "@/lib/api";
import { getToken } from "@/lib/session";

function formatInboxTime(iso: string | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";
  return formatPostTime(iso);
}

export default function MessagesInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const [list, me] = await Promise.all([
      api.getConversations(token),
      api.me(token),
    ]);
    setConversations(list);
    setUserId(me.id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load])
  );

  useRealtimeChannel({
    channel: userId ? `user:${userId}:inbox` : null,
    onEvent: (event) => {
      if (event.type === "inbox.updated") {
        load().catch(() => {});
      }
    },
    onPollFallback: () => load().catch(() => {}),
  });

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading messages" />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Messages</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New message"
          hitSlop={8}
          onPress={() => router.push("/(app)/messages/new")}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primaryDark} />
        </Pressable>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={[
          styles.list,
          conversations.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            message="Start with a parent from your circles or connect using their exact anonymous handle."
            actionLabel="New message"
            onAction={() => router.push("/(app)/messages/new")}
          />
        }
        renderItem={({ item }) => {
          const name = peerDisplayName(item.peer);
          const isSupport = name.toLowerCase().includes("support");
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/(app)/messages/[conversationId]",
                  params: {
                    conversationId: item.id,
                    peerHandle: name,
                  },
                })
              }
            >
              {isSupport ? (
                <View style={styles.supportAvatar}>
                  <Ionicons
                    name="shield-checkmark"
                    size={22}
                    color={colors.coral}
                  />
                </View>
              ) : (
                <Avatar handle={name} size={48} />
              )}
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={styles.handle} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.time}>
                    {formatInboxTime(item.lastMessage?.createdAt)}
                  </Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage?.body ?? "Start chatting"}
                </Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  handle: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    flex: 1,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  preview: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 3,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
