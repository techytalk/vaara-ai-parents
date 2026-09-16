import { useCallback, useEffect, useRef, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastSeqRef = useRef(0);

  const meQuery = useQuery({
    queryKey: ["sessionUser"],
    queryFn: () => authed((token) => api.me(token)),
  });

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
  const maxSeq = messages.reduce((max, item) => Math.max(max, item.seq), 0);
  lastSeqRef.current = maxSeq;

  const catchUp = useCallback(async () => {
    const afterSeq = lastSeqRef.current;
    if (mode === "thread" && threadId) {
      const page = await authed((token) =>
        api.getThreadMessages(token, threadId, { afterSeq })
      );
      if (page.messages.length === 0) {
        await listQuery.refetch();
        return;
      }
      queryClient.setQueryData(
        ["chatMessages", mode, circleId, threadId],
        (current: { messages: ChatMessage[]; nextCursor: number | null } | undefined) => {
          const existing = current?.messages ?? [];
          const seen = new Set(existing.map((item) => item.id));
          return {
            messages: [
              ...existing,
              ...page.messages.filter((item) => !seen.has(item.id)),
            ],
            nextCursor: current?.nextCursor ?? null,
          };
        }
      );
      return;
    }
    if (circleId) {
      const page = await authed((token) =>
        api.getGroupMessages(token, circleId, { afterSeq })
      );
      if (page.messages.length === 0) return;
      queryClient.setQueryData(
        ["chatMessages", mode, circleId, threadId],
        (current: { messages: ChatMessage[]; nextCursor: number | null } | undefined) => {
          const existing = current?.messages ?? [];
          const seen = new Set(existing.map((item) => item.id));
          return {
            messages: [
              ...existing,
              ...page.messages.filter((item) => !seen.has(item.id)),
            ],
            nextCursor: current?.nextCursor ?? null,
          };
        }
      );
    }
  }, [circleId, listQuery, mode, queryClient, threadId]);

  useRealtimeChannel({
    channel:
      mode === "thread" && threadId
        ? `thread:${threadId}`
        : circleId
          ? `circle:${circleId}`
          : null,
    onEvent: (event) => {
      if (event.type === "chat.message" || event.type === "access.revoked") {
        void catchUp();
        if (event.type === "access.revoked") {
          void threadQuery.refetch();
        }
      }
    },
    onPollFallback: () => {
      void catchUp();
    },
  });

  useEffect(() => {
    if (mode !== "thread" || !threadId || maxSeq === 0) return;
    void authed((token) => api.markThreadRead(token, threadId, maxSeq)).catch(
      () => {}
    );
  }, [maxSeq, mode, threadId]);

  const canReply =
    mode === "group" || threadQuery.data?.access.canReply !== false;

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (editingId) {
        const target = messages.find((item) => item.id === editingId);
        if (target) {
          await authed((token) =>
            api.editCircleMessage(token, target.circleId, editingId, body)
          );
        }
        setEditingId(null);
        setDraft("");
        await listQuery.refetch();
        return;
      }
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
      await catchUp();
    } finally {
      setSending(false);
    }
  }

  async function messageAuthor() {
    if (!threadId) return;
    const result = await authed((token) =>
      api.messageThreadAuthor(token, threadId)
    );
    if (result.conversationId) {
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: { conversationId: result.conversationId },
      });
    }
  }

  async function toggleMute() {
    if (!threadId) return;
    const muted = threadQuery.data?.muted === true;
    await authed((token) =>
      muted ? api.unmuteThread(token, threadId) : api.muteThread(token, threadId)
    );
    await threadQuery.refetch();
  }

  async function react(message: ChatMessage) {
    const mine = message.reactions?.some((item) => item.reaction === "👍" && item.mine);
    await authed((token) =>
      mine
        ? api.removeMessageReaction(token, message.circleId, message.id, "👍")
        : api.addMessageReaction(token, message.circleId, message.id, "👍")
    );
    await listQuery.refetch();
  }

  async function remove(message: ChatMessage) {
    await authed((token) =>
      api.deleteCircleMessage(token, message.circleId, message.id)
    );
    await listQuery.refetch();
  }

  function onLongPress(message: ChatMessage) {
    if (message.status !== "visible") return;
    const mine = message.author.userId === meQuery.data?.id;
    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    const buttons: Array<{
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }> = [
      { text: "React 👍", onPress: () => void react(message) },
    ];
    if (mine && ageMs <= 15 * 60 * 1000) {
      buttons.push({
        text: "Edit",
        onPress: () => {
          setEditingId(message.id);
          setDraft(message.body ?? "");
        },
      });
    }
    if (mine && ageMs <= 24 * 60 * 60 * 1000) {
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert("Delete message?", "Everyone in this chat will see it as deleted.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => void remove(message) },
          ]),
      });
    }
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Message", undefined, buttons);
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
          <View style={styles.topicActions}>
            <Text style={styles.meta}>{threadQuery.data.circleName}</Text>
            <Pressable onPress={() => void toggleMute()}>
              <Text style={styles.messageAuthor}>
                {threadQuery.data.muted ? "Unmute" : "Mute"}
              </Text>
            </Pressable>
          </View>
          {threadQuery.data.access.canMessageAuthor ? (
            <Pressable onPress={() => void messageAuthor()}>
              <Text style={styles.messageAuthor}>Message author</Text>
            </Pressable>
          ) : null}
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
        renderItem={({ item }) => (
          <Bubble
            message={item}
            highlight={item.id === editingId}
            onLongPress={() => onLongPress(item)}
            onReact={() => void react(item)}
          />
        )}
      />
      {canReply ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={editingId ? "Edit message" : "Message"}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          {editingId ? (
            <Pressable
              style={styles.send}
              onPress={() => {
                setEditingId(null);
                setDraft("");
              }}
            >
              <Text style={styles.sendLabel}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendLabel}>{editingId ? "Save" : "Send"}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.readonly}>You can read this thread, not reply.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  highlight,
  onLongPress,
  onReact,
}: {
  message: ChatMessage;
  highlight: boolean;
  onLongPress: () => void;
  onReact: () => void;
}) {
  const thumbs = message.reactions?.find((item) => item.reaction === "👍");
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.bubble, highlight && styles.bubbleEditing]}
    >
      <Text style={styles.author}>
        {message.author.displayName}
        {message.author.role === "provider" ? " · Tutor" : ""}
        {message.author.isGuest ? " · Guest" : ""}
      </Text>
      <Text style={styles.body}>
        {message.status === "visible" ? message.body : "Message deleted"}
      </Text>
      {message.editedAt && message.status === "visible" ? (
        <Text style={styles.edited}>edited</Text>
      ) : null}
      {thumbs ? (
        <Pressable onPress={onReact} style={styles.reactChip}>
          <Text style={styles.reactLabel}>👍 {thumbs.count}</Text>
        </Pressable>
      ) : null}
    </Pressable>
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
  topicActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontFamily: typography.medium,
    color: colors.primaryDark,
    fontSize: 12,
  },
  messageAuthor: {
    marginTop: 8,
    fontFamily: typography.semibold,
    color: colors.primaryDark,
  },
  list: { padding: spacing.md, gap: 8, paddingBottom: 24 },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleEditing: { borderColor: colors.primary },
  author: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 12,
    marginBottom: 4,
  },
  body: { fontFamily: typography.regular, color: colors.text, fontSize: 15 },
  edited: {
    marginTop: 4,
    fontFamily: typography.regular,
    color: colors.textSubtle,
    fontSize: 11,
  },
  reactChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reactLabel: { fontFamily: typography.medium, fontSize: 12, color: colors.text },
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
