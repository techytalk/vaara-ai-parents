import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, InlineError, ScreenLoader, SearchField, SectionHeader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import {
  api,
  type AuthUser,
  type MessageableParent,
  type ParentConnectionRequest,
} from "@/lib/api";
import { getToken } from "@/lib/session";

export default function NewMessageScreen() {
  const router = useRouter();
  const { handle: invitedHandle } = useLocalSearchParams<{ handle?: string }>();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [suggestions, setSuggestions] = useState<MessageableParent[]>([]);
  const [incoming, setIncoming] = useState<ParentConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ParentConnectionRequest[]>([]);
  const [search, setSearch] = useState("");
  const [handle, setHandle] = useState(invitedHandle ?? "");
  const [introduction, setIntroduction] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q = "") => {
    const token = await getToken();
    if (!token) return;
    const [user, peers, requests] = await Promise.all([
      api.me(token),
      api.getMessageSuggestions(token, q),
      api.getConnectionRequests(token),
    ]);
    setMe(user);
    setSuggestions(peers);
    setIncoming(requests.incoming);
    setOutgoing(requests.outgoing);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : "Could not load")
        )
        .finally(() => setLoading(false));
    }, [load])
  );

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      load(search).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [load, loading, search]);

  useRealtimeChannel({
    channel: me ? `user:${me.id}:inbox` : null,
    onEvent: (event) => {
      if (event.type === "inbox.updated") {
        load(search).catch(() => {});
      }
    },
    onPollFallback: () => load(search).catch(() => {}),
  });

  async function openSuggestion(parent: MessageableParent) {
    setWorkingId(parent.userId);
    setError(null);
    try {
      if (parent.existingConversationId) {
        router.replace({
          pathname: "/(app)/messages/[conversationId]",
          params: {
            conversationId: parent.existingConversationId,
            peerHandle: parent.anonymousHandle,
          },
        });
        return;
      }
      const token = await getToken();
      if (!token) return;
      const result = await api.startConversation(token, {
        peerUserId: parent.userId,
        circleId: parent.circleId,
      });
      router.replace({
        pathname: "/(app)/messages/[conversationId]",
        params: {
          conversationId: result.id,
          peerHandle: parent.anonymousHandle,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start chat");
    } finally {
      setWorkingId(null);
    }
  }

  async function sendRequest() {
    const exactHandle = handle.trim();
    if (!exactHandle) {
      setError("Enter the complete anonymous handle");
      return;
    }
    setWorkingId("new-request");
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.requestParentConnection(token, {
        anonymousHandle: exactHandle,
        introduction: introduction.trim() || undefined,
      });
      if (result.kind === "conversation") {
        router.replace({
          pathname: "/(app)/messages/[conversationId]",
          params: {
            conversationId: result.conversation.id,
            peerHandle: result.conversation.peer.anonymousHandle,
          },
        });
        return;
      }
      setHandle("");
      setIntroduction("");
      await load(search);
      Alert.alert("Request sent", "They can accept it from Messages.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send request");
    } finally {
      setWorkingId(null);
    }
  }

  async function respond(
    request: ParentConnectionRequest,
    action: "accept" | "decline" | "cancel"
  ) {
    setWorkingId(request.id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.respondToConnectionRequest(
        token,
        request.id,
        action
      );
      if (action === "accept" && result.conversationId) {
        router.replace({
          pathname: "/(app)/messages/[conversationId]",
          params: {
            conversationId: result.conversationId,
            peerHandle: request.peer.anonymousHandle,
          },
        });
        return;
      }
      await load(search);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update request"
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function shareHandle() {
    if (!me) return;
    const inviteUrl = `vaara-parents://messages/new?handle=${encodeURIComponent(
      me.anonymousHandle
    )}`;
    await Share.share({
      message: `Connect with me privately on Vaara Parents using my anonymous handle: ${me.anonymousHandle}\n${inviteUrl}`,
    });
  }

  function showRequestSafety(request: ParentConnectionRequest) {
    Alert.alert(request.peer.anonymousHandle, "Choose a safety action.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.reportConnectionRequest(token, request.id);
          Alert.alert("Reported", "Thank you. Our safety team can review it.");
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.blockUser(token, request.peer.userId);
          await load(search);
        },
      },
    ]);
  }

  if (loading) return <ScreenLoader label="Loading parents" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.privacyCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryDark} />
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>Private by default</Text>
          <Text style={styles.privacyBody}>
            Find shared-circle parents here, or use an exact anonymous handle.
            Real names and family details are never searchable.
          </Text>
        </View>
      </View>

      {error ? <InlineError message={error} /> : null}

      {incoming.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Connection requests" />
          {incoming.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <Avatar handle={request.peer.anonymousHandle} size={42} />
              <View style={styles.rowCopy}>
                <Text style={styles.name}>{request.peer.anonymousHandle}</Text>
                {request.introduction ? (
                  <Text style={styles.meta} numberOfLines={2}>
                    {request.introduction}
                  </Text>
                ) : null}
              </View>
              <View style={styles.requestActions}>
                <Pressable
                  style={styles.acceptBtn}
                  disabled={workingId === request.id}
                  onPress={() => respond(request, "accept")}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  disabled={workingId === request.id}
                  onPress={() => respond(request, "decline")}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => showRequestSafety(request)}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Parents in your circles" />
        <SearchField
          placeholder="Filter by anonymous handle"
          value={search}
          onChangeText={setSearch}
        />
        {suggestions.length === 0 ? (
          <Text style={styles.emptyText}>No matching shared-circle parents.</Text>
        ) : (
          suggestions.map((parent) => (
            <Pressable
              key={parent.userId}
              style={styles.parentRow}
              disabled={workingId === parent.userId}
              onPress={() => openSuggestion(parent)}
            >
              <Avatar handle={parent.anonymousHandle} size={44} />
              <View style={styles.rowCopy}>
                <Text style={styles.name}>{parent.anonymousHandle}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[parent.contextLabel, parent.circleName]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Ionicons
                name={parent.existingConversationId ? "chatbubble-outline" : "chevron-forward"}
                size={18}
                color={colors.primaryDark}
              />
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Connect by exact handle" />
        <View style={styles.exactCard}>
          <TextInput
            style={styles.input}
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Parent-7F2A"
            placeholderTextColor={colors.textSubtle}
          />
          <TextInput
            style={[styles.input, styles.introInput]}
            value={introduction}
            onChangeText={setIntroduction}
            maxLength={280}
            multiline
            placeholder="Short introduction (optional)"
            placeholderTextColor={colors.textSubtle}
          />
          <Pressable
            style={styles.sendRequestBtn}
            disabled={workingId === "new-request"}
            onPress={sendRequest}
          >
            <Text style={styles.sendRequestText}>Send connection request</Text>
          </Pressable>
        </View>
      </View>

      {outgoing.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Pending requests" />
          {outgoing.map((request) => (
            <View key={request.id} style={styles.parentRow}>
              <Avatar handle={request.peer.anonymousHandle} size={40} />
              <View style={styles.rowCopy}>
                <Text style={styles.name}>{request.peer.anonymousHandle}</Text>
                <Text style={styles.meta}>Waiting for acceptance</Text>
              </View>
              <Pressable onPress={() => respond(request, "cancel")}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.shareBtn} onPress={shareHandle}>
        <Ionicons name="share-outline" size={18} color={colors.primaryDark} />
        <Text style={styles.shareText}>Share my anonymous handle</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  section: { gap: spacing.xs },
  privacyCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  privacyCopy: { flex: 1 },
  privacyTitle: {
    ...typography.supporting,
    color: colors.navy,
    fontFamily: typography.bold,
  },
  privacyBody: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.regular,
    lineHeight: 18,
    marginTop: 3,
  },
  parentRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  name: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  requestActions: { flexDirection: "row", gap: 6 },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  exactCard: {
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.regular,
  },
  introInput: { minHeight: 72, paddingTop: spacing.sm },
  sendRequestBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendRequestText: {
    ...typography.supporting,
    color: "#fff",
    fontFamily: typography.bold,
  },
  cancelText: {
    ...typography.caption,
    color: colors.coral,
    fontFamily: typography.semibold,
  },
  emptyText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  shareBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shareText: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
});
