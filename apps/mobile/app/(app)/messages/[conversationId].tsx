import { useCallback, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { DisclosurePrompt } from "@/components/DisclosurePrompt";
import { InlineError, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import {
  api,
  peerDisplayName,
  type DirectMessage,
  type DisclosureState,
  type PeerView,
} from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ChatScreen() {
  const { conversationId, peerHandle } = useLocalSearchParams<{
    conversationId: string;
    peerHandle?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [disclosing, setDisclosing] = useState(false);
  const [promptLevel, setPromptLevel] = useState<2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chatQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [messageData, disclosureData] = await Promise.all([
        api.getMessages(token, conversationId),
        api.getDisclosure(token, conversationId),
      ]);
      await api.markConversationRead(token, conversationId);
      return {
        messages: messageData.messages,
        peer: messageData.peer,
        disclosure: disclosureData,
      };
    },
  });

  const refreshChat = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
  }, [conversationId, queryClient]);

  useRealtimeChannel({
    channel: conversationId ? `conversation:${conversationId}` : null,
    onEvent: (event) => {
      if (event.type === "message.new") {
        refreshChat();
      }
    },
    onPollFallback: refreshChat,
  });

  const messages = chatQuery.data?.messages ?? [];
  const peer = chatQuery.data?.peer ?? null;
  const disclosure = chatQuery.data?.disclosure ?? null;
  const loading = chatQuery.isLoading;

  useLayoutEffect(() => {
    const name = peer ? peerDisplayName(peer) : peerHandle ?? "Parent";
    navigation.setOptions({
      title: name,
      headerRight: peer
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Conversation safety options"
              hitSlop={8}
              onPress={showSafetyActions}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={colors.text}
              />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, peer, peerHandle]);

  function showSafetyActions() {
    if (!peer) return;
    Alert.alert(peerDisplayName(peer), "Choose a safety action.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report conversation",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.reportConversation(token, conversationId);
          Alert.alert("Reported", "Thank you. Our safety team can review it.");
        },
      },
      {
        text: "Block parent",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.blockUser(token, peer.userId);
          router.back();
        },
      },
    ]);
  }

  async function confirmDisclosure(level: 2 | 3) {
    setDisclosing(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.offerDisclosure(token, conversationId, {
        level,
        purpose: level === 3 ? "carpool" : "marketplace",
      });
      queryClient.setQueryData(
        ["conversation", conversationId],
        (current: {
          messages: DirectMessage[];
          peer: PeerView | null;
          disclosure: DisclosureState;
        } | undefined) =>
          current
            ? {
                ...current,
                disclosure: result,
                peer: result.peer ?? current.peer,
              }
            : current
      );
      setPromptLevel(null);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not share identity";
      if (message.includes("first name")) {
        Alert.alert("Contact details needed", message, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add details",
            onPress: () => router.push("/(app)/contact-details"),
          },
        ]);
      } else {
        setError(message);
      }
    } finally {
      setDisclosing(false);
    }
  }

  async function onSend() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const msg = await api.sendMessage(token, conversationId, body);
      queryClient.setQueryData(
        ["conversation", conversationId],
        (current: {
          messages: DirectMessage[];
          peer: PeerView | null;
          disclosure: DisclosureState | null;
        } | undefined) =>
          current
            ? { ...current, messages: [...current.messages, msg] }
            : current
      );
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <ScreenLoader label="Loading conversation" />;

  const needsAccept =
    disclosure &&
    disclosure.peerOffer > disclosure.ownOffer &&
    disclosure.peerOffer >= 2;
  const canOfferHandover =
    disclosure && disclosure.effectiveLevel < 2 && disclosure.ownOffer < 2;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {peer ? (
        <View style={styles.peerCard}>
          <Text style={styles.peerName}>{peerDisplayName(peer)}</Text>
          {peer.contextLabel ? (
            <Text style={styles.peerContext}>{peer.contextLabel}</Text>
          ) : null}
          {peer.disclosureLevel >= 2 && peer.blockOrFlat ? (
            <Text style={styles.peerDetail}>Flat: {peer.blockOrFlat}</Text>
          ) : null}
          {peer.disclosureLevel >= 3 && peer.contactPhone ? (
            <Text style={styles.peerDetail}>Phone: {peer.contactPhone}</Text>
          ) : null}
        </View>
      ) : null}

      {needsAccept ? (
        <Pressable
          style={styles.banner}
          onPress={() => setPromptLevel(disclosure!.peerOffer as 2 | 3)}
        >
          <Text style={styles.bannerTitle}>Identity sharing requested</Text>
          <Text style={styles.bannerBody}>
            Tap to review and share your first name and flat number.
          </Text>
        </Pressable>
      ) : null}

      {canOfferHandover ? (
        <Pressable
          style={styles.bannerSecondary}
          onPress={() => setPromptLevel(2)}
        >
          <Text style={styles.bannerSecondaryText}>
            Arranging handover? Share first name and flat number
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.isMine ? styles.bubbleMine : styles.bubbleTheir,
            ]}
          >
            {!item.isMine ? (
              <Text style={styles.bubbleHandle}>{item.senderHandle}</Text>
            ) : null}
            <Text
              style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}
            >
              {item.body}
            </Text>
          </View>
        )}
      />

      {error ? <InlineError message={error} /> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor={colors.textSubtle}
          value={text}
          onChangeText={setText}
        />
        <Pressable
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      <DisclosurePrompt
        visible={promptLevel != null}
        level={promptLevel ?? 2}
        onConfirm={() => promptLevel && confirmDisclosure(promptLevel)}
        onCancel={() => setPromptLevel(null)}
        loading={disclosing}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  peerCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  peerName: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.bold,
  },
  peerContext: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  peerDetail: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: 6,
  },
  banner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  bannerTitle: {
    ...typography.supporting,
    color: colors.navy,
    fontFamily: typography.bold,
  },
  bannerBody: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  bannerSecondary: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    padding: spacing.xs,
    alignItems: "center",
  },
  bannerSecondaryText: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  list: { padding: spacing.md, paddingBottom: spacing.xs },
  bubble: {
    maxWidth: "85%",
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleTheir: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleHandle: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    marginBottom: 4,
  },
  bubbleText: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    lineHeight: 22,
  },
  bubbleTextMine: { color: colors.textInverse },
  inputRow: {
    flexDirection: "row",
    padding: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: typography.regular,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.6 },
});
