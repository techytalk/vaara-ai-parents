import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type ChatMessage } from "@/lib/api";
import { getToken } from "@/lib/session";
import { randomUUID } from "@/lib/uuid";

async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

export function ChatThreadScreen({
  mode,
  circleId,
  threadId,
}: {
  mode: "group" | "thread";
  circleId?: string;
  threadId?: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threadQuery = useQuery({
    queryKey: ["chatThread", threadId],
    queryFn: () => authed((token) => api.getThread(token, threadId!)),
    enabled: mode === "thread" && Boolean(threadId),
  });

  const listQuery = useQuery({
    queryKey: ["chatMessages", mode, circleId, threadId],
    queryFn: async () => {
      if (mode === "thread" && threadId) {
        return authed((token) => api.getThreadMessages(token, threadId));
      }
      return authed((token) => api.getGroupMessages(token, circleId!));
    },
    enabled: mode === "thread" ? Boolean(threadId) : Boolean(circleId),
  });

  const messages = listQuery.data?.messages ?? [];
  const canReply =
    mode === "group" || threadQuery.data?.access.canReply !== false;

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await authed((token) =>
        mode === "thread" && threadId
          ? api.sendThreadMessage(token, threadId, {
              body,
              clientMessageId: randomUUID(),
            })
          : api.sendGroupMessage(token, circleId!, {
              body,
              clientMessageId: randomUUID(),
            })
      );
      setDraft("");
      await listQuery.refetch();
      if (mode === "thread" && threadId) {
        await authed((token) => api.markThreadRead(token, threadId));
      }
    } finally {
      setSending(false);
    }
  }

  if (listQuery.isLoading) {
    return <ScreenLoader label="Loading chat" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      {mode === "thread" && threadQuery.data ? (
        <View style={styles.topic}>
          <Text style={styles.topicTitle}>
            {threadQuery.data.title || threadQuery.data.body || "Thread"}
          </Text>
          {threadQuery.data.body && threadQuery.data.title ? (
            <Text style={styles.topicBody}>{threadQuery.data.body}</Text>
          ) : null}
          <Text style={styles.meta}>{threadQuery.data.circleName}</Text>
        </View>
      ) : null}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No messages yet"
            message="Say hello — this is the start of the conversation."
          />
        }
        renderItem={({ item }) => <Bubble message={item} />}
      />
      {canReply ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.readonly}>You can read this thread, not reply.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  return (
    <View style={styles.bubble}>
      <Text style={styles.author}>
        {message.author.displayName}
        {message.author.role === "provider" ? " · Tutor" : ""}
        {message.author.isGuest ? " · Guest" : ""}
      </Text>
      <Text style={styles.body}>
        {message.status === "visible" ? message.body : "Message deleted"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topic: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  topicTitle: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 18,
  },
  topicBody: {
    marginTop: 4,
    fontFamily: typography.regular,
    color: colors.textMuted,
  },
  meta: {
    marginTop: 6,
    fontFamily: typography.medium,
    color: colors.primaryDark,
    fontSize: 12,
  },
  list: { padding: spacing.md, gap: 8, paddingBottom: 24 },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  author: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 12,
    marginBottom: 4,
  },
  body: { fontFamily: typography.regular, color: colors.text, fontSize: 15 },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontFamily: typography.regular,
    color: colors.text,
  },
  send: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { fontFamily: typography.semibold, color: colors.textInverse },
  readonly: {
    textAlign: "center",
    padding: spacing.md,
    color: colors.textMuted,
  },
});
