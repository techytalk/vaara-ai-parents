import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { DisclosurePrompt } from "@/components/DisclosurePrompt";
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
    navigation.setOptions({ title: name });
  }, [navigation, peer, peerHandle]);

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
      queryClient.setQueryData(["conversation", conversationId], (current: {
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not share identity";
      if (message.includes("first name")) {
        Alert.alert(
          "Contact details needed",
          message,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add details",
              onPress: () => router.push("/(app)/contact-details"),
            },
          ]
        );
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
      queryClient.setQueryData(["conversation", conversationId], (current: {
        messages: DirectMessage[];
        peer: PeerView | null;
        disclosure: DisclosureState | null;
      } | undefined) =>
        current
          ? { ...current, messages: [...current.messages, msg] }
          : current
      );
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const needsAccept =
    disclosure &&
    disclosure.peerOffer > disclosure.ownOffer &&
    disclosure.peerOffer >= 2;
  const canOfferHandover =
    disclosure &&
    disclosure.effectiveLevel < 2 &&
    disclosure.ownOffer < 2;

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
          {peer.disclosureLevel >= 3 && peer.vehicleDescription ? (
            <Text style={styles.peerDetail}>
              Vehicle: {peer.vehicleDescription}
            </Text>
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
            {!item.isMine && (
              <Text style={styles.bubbleHandle}>{item.senderHandle}</Text>
            )}
            <Text
              style={[
                styles.bubbleText,
                item.isMine && styles.bubbleTextMine,
              ]}
            >
              {item.body}
            </Text>
          </View>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendBtn} onPress={onSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>Send</Text>
          )}
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
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  peerCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  peerName: { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  peerContext: { fontSize: 13, color: "#5c5c7a", marginTop: 4 },
  peerDetail: { fontSize: 14, color: "#1a1a2e", marginTop: 6 },
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  bannerTitle: { fontWeight: "700", color: "#312e81", fontSize: 14 },
  bannerBody: { color: "#4338ca", fontSize: 13, marginTop: 4, lineHeight: 18 },
  bannerSecondary: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    alignItems: "center",
  },
  bannerSecondaryText: {
    color: "#4f46e5",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  list: { padding: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: "85%",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#4f46e5",
  },
  bubbleTheir: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  bubbleHandle: { fontSize: 11, color: "#4f46e5", marginBottom: 4 },
  bubbleText: { fontSize: 15, color: "#1a1a2e", lineHeight: 22 },
  bubbleTextMine: { color: "#fff" },
  error: { color: "#dc2626", paddingHorizontal: 12 },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e4ef",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f8f9fc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});
