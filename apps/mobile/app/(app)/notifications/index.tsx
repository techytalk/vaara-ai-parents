import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  isDigestNotification,
  notificationIcon,
} from "@/lib/notification-display";
import { api, type AppNotification } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";

function formatNotificationTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getNotifications(token);
    setItems(list);
  }, []);

  useEffect(() => {
    trackEvent("notification_center_opened");
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function onPressItem(item: AppNotification) {
    const token = await getToken();
    if (!token) return;
    if (!item.readAt) {
      await api.markNotificationRead(token, item.id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    }

    const data = item.data;
    if (item.type === "direct_message" && data.conversationId) {
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: { conversationId: String(data.conversationId) },
      });
    } else if (item.type === "connection_request") {
      router.push("/(app)/messages/new");
    } else if (
      (item.type === "disclosure_request" ||
        item.type === "disclosure_accepted") &&
      data.conversationId
    ) {
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: { conversationId: String(data.conversationId) },
      });
    } else if (item.type === "circle_post" && data.circleId) {
      router.push({
        pathname: "/circles/[circleId]",
        params: { circleId: String(data.circleId) },
      });
    } else if (data.activityId) {
      router.push({
        pathname: "/(app)/activities/[id]",
        params: { id: String(data.activityId) },
      });
    }
  }

  async function onMarkAllRead() {
    const token = await getToken();
    if (!token) return;
    await api.markAllNotificationsRead(token);
    await load();
  }

  if (loading) {
    return <ScreenLoader label="Loading alerts" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hint}>
          Immediate alerts include messages and replies. Digests bundle circle
          posts, topics, and nearby activity.
        </Text>
        {items.some((item) => !item.readAt) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications read"
            onPress={onMarkAllRead}
            hitSlop={8}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No alerts yet"
            message="Circle digests, messages, and reminders will appear here."
          />
        }
        renderItem={({ item }) => {
          const digest = isDigestNotification(item.type);
          const unread = !item.readAt;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                unread && styles.rowUnread,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${digest ? "Digest" : "Immediate"}${unread ? ", unread" : ""}`}
              onPress={() => onPressItem(item)}
            >
              <View
                style={[
                  styles.iconWrap,
                  digest ? styles.iconDigest : styles.iconImmediate,
                ]}
              >
                <Ionicons
                  name={notificationIcon(item.type)}
                  size={18}
                  color={digest ? colors.lavender : colors.primary}
                />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, unread && styles.titleUnread]}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.deliveryBadge,
                      digest ? styles.digestBadge : styles.immediateBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.deliveryText,
                        digest ? styles.digestText : styles.immediateText,
                      ]}
                    >
                      {digest ? "Digest" : "Immediate"}
                    </Text>
                  </View>
                </View>
                {item.body ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={styles.time}>
                  {formatNotificationTime(item.createdAt)}
                </Text>
              </View>
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  hint: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  markAllText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
    alignSelf: "flex-end",
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySoft,
  },
  rowPressed: { opacity: 0.92 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImmediate: { backgroundColor: `${colors.primary}18` },
  iconDigest: { backgroundColor: `${colors.lavender}18` },
  copy: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    flex: 1,
  },
  titleUnread: { color: colors.navy },
  deliveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  digestBadge: { backgroundColor: `${colors.lavender}22` },
  immediateBadge: { backgroundColor: `${colors.primary}18` },
  deliveryText: {
    ...typography.caption,
    fontFamily: typography.semibold,
    fontSize: 10,
  },
  digestText: { color: colors.lavender },
  immediateText: { color: colors.primaryDark },
  body: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  time: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.regular,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
    marginTop: 6,
  },
});
