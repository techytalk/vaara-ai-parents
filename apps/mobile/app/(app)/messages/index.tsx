import { useCallback, useMemo, useState } from "react";
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
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useNavFrom } from "@/hooks/useOriginBack";
import {
  api,
  type ChatInbox,
  type ChatInboxDm,
  type ChatInboxGroup,
  type ChatInboxGuestThread,
  type ChatInboxService,
  type Circle,
} from "@/lib/api";
import { circleTypeIcon } from "@/lib/circle-icons";
import { backLabelForOrigin, leaveToOrigin } from "@/lib/nav-back";
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

function circleTypeLabel(type: string): string {
  return (
    CIRCLE_TYPE_LABELS[type as Circle["circleType"]] ?? "Parent group"
  );
}

type InboxRow =
  | { rowKey: string; kind: "section"; title: string }
  | (ChatInboxGuestThread & { rowKey: string })
  | (ChatInboxGroup & { rowKey: string })
  | (ChatInboxDm & { rowKey: string })
  | (ChatInboxService & { rowKey: string })
  | {
      rowKey: string;
      kind: "matched";
      id: string;
      title: string | null;
      body: string | null;
      circleName: string;
    };

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

function GroupRow({
  item,
  onPress,
}: {
  item: ChatInboxGroup;
  onPress: () => void;
}) {
  const typeLabel = circleTypeLabel(item.circleType);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${typeLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.groupCard, pressed && styles.pressed]}
    >
      <View style={styles.groupIcon}>
        <Ionicons
          name={circleTypeIcon(item.circleType)}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={styles.groupName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.lastAt ? (
            <Text style={styles.time}>{formatInboxTime(item.lastAt)}</Text>
          ) : null}
        </View>
        <Text style={styles.groupType} numberOfLines={1}>
          {typeLabel}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {item.preview ?? "No messages yet"}
        </Text>
      </View>
      <UnreadBadge count={item.unreadCount} />
    </Pressable>
  );
}

export default function MessagesInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const from = useNavFrom();
  const showOriginBack = Boolean(from);
  const backLabel = backLabelForOrigin(from);
  const [inbox, setInbox] = useState<ChatInbox>({
    groups: [],
    guestThreads: [],
    dms: [],
    services: [],
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [matched, setMatched] = useState<
    Array<{
      id: string;
      title: string | null;
      body: string | null;
      circleName: string;
    }>
  >([]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const [list, me] = await Promise.all([
      api.getChatInbox(token),
      api.me(token),
    ]);
    setInbox(list);
    setUserId(me.id);
    if (me.roles?.includes("provider") || me.role === "provider") {
      const result = await api
        .getMatchedThreads(token)
        .catch(() => ({ threads: [] }));
      setMatched(result.threads);
    } else {
      setMatched([]);
    }
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

  const rows = useMemo((): InboxRow[] => {
    const next: InboxRow[] = [];

    if (matched.length > 0) {
      next.push({ rowKey: "sec:matched", kind: "section", title: "Parent requests" });
      for (const thread of matched) {
        next.push({
          ...thread,
          rowKey: `m:${thread.id}`,
          kind: "matched",
        });
      }
    }

    const guests = inbox.guestThreads ?? [];
    if (guests.length > 0) {
      next.push({
        rowKey: "sec:guest",
        kind: "section",
        title: "Your questions",
      });
      for (const item of guests) {
        next.push({ ...item, rowKey: `gt:${item.id}` });
      }
    }

    if (inbox.groups.length > 0) {
      next.push({
        rowKey: "sec:groups",
        kind: "section",
        title: "Your groups",
      });
      for (const item of inbox.groups) {
        next.push({ ...item, rowKey: `g:${item.id}` });
      }
    }

    if (inbox.dms.length > 0) {
      next.push({
        rowKey: "sec:dms",
        kind: "section",
        title: "Direct messages",
      });
      for (const item of inbox.dms) {
        next.push({ ...item, rowKey: `d:${item.id}` });
      }
    }

    if (inbox.services.length > 0) {
      next.push({
        rowKey: "sec:services",
        kind: "section",
        title: "Tutors",
      });
      for (const item of inbox.services) {
        next.push({ ...item, rowKey: `s:${item.id}` });
      }
    }

    return next;
  }, [inbox, matched]);

  if (loading) {
    return <ScreenLoader label="Loading messages" />;
  }

  const isEmpty =
    (inbox.guestThreads?.length ?? 0) +
      inbox.groups.length +
      inbox.dms.length +
      inbox.services.length +
      matched.length ===
    0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {showOriginBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${backLabel}`}
            onPress={() => leaveToOrigin(router, { from })}
            hitSlop={8}
            style={styles.headerBack}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
            <Text style={styles.headerBackText} numberOfLines={1}>
              {backLabel}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.headerBackPad} />
        )}
        <Text style={styles.title}>Messages</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New message"
          hitSlop={8}
          onPress={() => router.push("/(app)/messages/new")}
          style={styles.headerRight}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primaryDark} />
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.rowKey}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            message="Your groups and 1:1 chats live here."
            actionLabel="New message"
            onAction={() => router.push("/(app)/messages/new")}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === "section") {
            return <Text style={styles.section}>{item.title}</Text>;
          }

          if (item.kind === "matched") {
            return (
              <Pressable
                style={styles.chatRow}
                onPress={() => {
                  void (async () => {
                    const token = await getToken();
                    if (!token) return;
                    await api.openProviderThread(token, item.id);
                    router.push({
                      pathname: "/(app)/messages/threads/[threadId]",
                      params: { threadId: item.id },
                    });
                  })();
                }}
              >
                <View style={[styles.supportAvatar, styles.warningAvatar]}>
                  <Ionicons name="briefcase" size={20} color={colors.warning} />
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.handle} numberOfLines={1}>
                    {item.title || item.body || "Service request"}
                  </Text>
                  <Text style={styles.circleMeta} numberOfLines={2}>
                    {item.circleName}
                  </Text>
                </View>
              </Pressable>
            );
          }

          if (item.kind === "guest_thread") {
            return (
              <Pressable
                style={styles.chatRow}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/messages/threads/[threadId]",
                    params: { threadId: item.id },
                  })
                }
              >
                <View style={styles.supportAvatar}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={22}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.handle} numberOfLines={1}>
                      {item.title || item.preview || "Your question"}
                    </Text>
                    <Text style={styles.time}>
                      {formatInboxTime(item.lastAt ?? undefined)}
                    </Text>
                  </View>
                  <Text style={styles.circleMeta} numberOfLines={2}>
                    Guest · {item.circleName}
                    {item.replyCount > 0 ? ` · ${item.replyCount} replies` : ""}
                  </Text>
                </View>
                <UnreadBadge count={item.unreadCount} />
              </Pressable>
            );
          }

          if (item.kind === "group") {
            return (
              <GroupRow
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/messages/groups/[circleId]",
                    params: {
                      circleId: item.id,
                      circleName: item.name,
                    },
                  })
                }
              />
            );
          }

          if (item.kind === "service") {
            return (
              <Pressable
                style={styles.chatRow}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/messages/channels/[providerId]",
                    params: { providerId: item.id },
                  })
                }
              >
                <View style={[styles.supportAvatar, styles.serviceAvatar]}>
                  <Ionicons
                    name="briefcase-outline"
                    size={22}
                    color={colors.coral}
                  />
                </View>
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.handle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.time}>
                      {formatInboxTime(item.lastAt ?? undefined)}
                    </Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.preview ?? "Tutor"}
                  </Text>
                </View>
              </Pressable>
            );
          }

          const name = item.peer.anonymousHandle;
          return (
            <Pressable
              style={styles.chatRow}
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
              <Avatar handle={name} avatarKey={item.peer.avatarKey} size={48} />
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={styles.handle} numberOfLines={1}>
                    {name}
                    {item.peerRole === "provider" ? " · Tutor" : ""}
                  </Text>
                  <Text style={styles.time}>
                    {formatInboxTime(item.lastAt ?? undefined)}
                  </Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.preview ?? "Start chatting"}
                </Text>
              </View>
              <UnreadBadge count={item.unreadCount} />
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
    gap: spacing.sm,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 72,
    maxWidth: 110,
  },
  headerBackText: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
    marginLeft: -2,
  },
  headerBackPad: { minWidth: 72 },
  headerRight: { minWidth: 72, alignItems: "flex-end" },
  title: {
    flex: 1,
    textAlign: "center",
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  section: {
    fontFamily: typography.semibold,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  groupType: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primaryDark,
    fontFamily: typography.medium,
  },
  chatRow: {
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
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  warningAvatar: { backgroundColor: colors.warningSoft },
  serviceAvatar: { backgroundColor: colors.accentLight },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 2,
  },
  circleMeta: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    fontFamily: typography.medium,
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
    alignSelf: "center",
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
