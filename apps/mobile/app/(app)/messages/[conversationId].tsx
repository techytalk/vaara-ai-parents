import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, type DirectMessage } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ChatScreen() {
  const { conversationId, peerHandle } = useLocalSearchParams<{
    conversationId: string;
    peerHandle?: string;
  }>();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await api.getMessages(token, conversationId);
    setMessages(data.messages);
    await api.markConversationRead(token, conversationId);
  }, [conversationId]);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function onSend() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const msg = await api.sendMessage(token, conversationId, body);
      setMessages((prev) => [...prev, msg]);
      setText("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Text style={styles.headerHint}>
        Chatting with {peerHandle ?? "parent"} — identities stay anonymous
      </Text>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerHint: {
    fontSize: 12,
    color: "#5c5c7a",
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
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
