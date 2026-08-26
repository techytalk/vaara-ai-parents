import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthorAvatar,
  cardShadow,
  EmptyState,
  ScreenLoader,
  theme,
} from "@/components/circles/ui";
import { api, type CircleMember } from "@/lib/api";
import { getToken } from "@/lib/session";

function MemberCard({
  member,
  onMessage,
  messaging,
}: {
  member: CircleMember;
  onMessage: () => void;
  messaging: boolean;
}) {
  return (
    <View style={[styles.memberCard, cardShadow()]}>
      <AuthorAvatar handle={member.anonymousHandle} size={48} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberHandle}>{member.anonymousHandle}</Text>
        {member.contextLabel ? (
          <Text style={styles.memberContext}>{member.contextLabel}</Text>
        ) : (
          <Text style={styles.memberContext}>Parent in this circle</Text>
        )}
      </View>
      <Pressable
        style={[styles.messageBtn, messaging && styles.messageBtnDisabled]}
        onPress={onMessage}
        disabled={messaging}
      >
        <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
        <Text style={styles.messageBtnText}>Message</Text>
      </Pressable>
    </View>
  );
}

export default function CircleMembersScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getCircleMembers(token, circleId);
    setMembers(list);
  }, [circleId]);

  useEffect(() => {
    load()
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  async function onMessage(peerUserId: string) {
    setMessagingId(peerUserId);
    setError(null);
    const token = await getToken();
    if (!token) return;
    try {
      const conv = await api.startConversation(token, {
        peerUserId,
        circleId,
      });
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: {
          conversationId: conv.id,
          peerHandle: conv.peer.anonymousHandle,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start chat");
    } finally {
      setMessagingId(null);
    }
  }

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.banner, cardShadow()]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
        <Text style={styles.bannerText}>
          Everyone stays anonymous. Message parents to discuss privately.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={
          members.length === 0 ? styles.emptyList : styles.listContent
        }
        ListHeaderComponent={
          members.length > 0 ? (
            <Text style={styles.countLabel}>
              {members.length} parent{members.length !== 1 ? "s" : ""} in this
              circle
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No members yet"
            subtitle="When other parents join this circle, you'll see them here and can message them anonymously."
          />
        }
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            messaging={messagingId === item.userId}
            onMessage={() => onMessage(item.userId)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.primaryLight,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
    lineHeight: 18,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
  },
  errorText: { color: theme.error, fontSize: 14 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  countLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  memberInfo: { flex: 1 },
  memberHandle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },
  memberContext: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 3,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
  },
  messageBtnDisabled: { opacity: 0.6 },
  messageBtnText: {
    color: theme.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
