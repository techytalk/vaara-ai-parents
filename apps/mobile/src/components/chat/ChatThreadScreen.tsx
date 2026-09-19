import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar, EmptyState, ScreenLoader } from "@/components/ui";
import {
  ChatMessageAttachments,
  attachmentQuoteLabel,
} from "@/components/chat/ChatMessageAttachments";
import {
  colors,
  radii,
  shadows,
  spacing,
  tabBarStyleForInsets,
  typography,
} from "@/constants/theme";
import { useBottomChromeInset } from "@/hooks/useBottomChromeInset";
import {
  useAndroidImeDockOffset,
  useKeyboardHeight,
} from "@/hooks/useKeyboardHeight";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, type ChatMessage } from "@/lib/api";
import {
  MAX_POST_DOCUMENTS,
  documentsBusy,
  pickDocuments,
  uploadAndScanDocument,
  type PendingDocument,
} from "@/lib/document-upload";
import {
  persistPickedMediaUri,
  resolveMediaBytes,
  uploadMediaBytes,
} from "@/lib/media-local";
import { getToken } from "@/lib/session";
import { randomUUID } from "@/lib/uuid";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;
const MAX_CHAT_MEDIA = 4;

type PendingChatMedia = {
  localId: string;
  uri: string;
  fileName: string;
  mediaType: "image" | "video";
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  storageKey?: string;
  status: "uploading" | "ready" | "failed";
  reason?: string;
};

async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const bottomChrome = useBottomChromeInset();
  const keyboardHeight = useKeyboardHeight();
  // Tabs are hidden in chat, so the closed inset lives on the composer as
  // paddingBottom — same Post/Save dock pattern, without double-counting.
  const androidDockOffset = useAndroidImeDockOffset(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetMessage, setSheetMessage] = useState<ChatMessage | null>(null);
  const [sheetMode, setSheetMode] = useState<"react" | "more">("react");
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<ChatMessage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingChatMedia[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const lastSeqRef = useRef(0);

  useLayoutEffect(() => {
    let current = navigation;
    let tabs = navigation.getParent();
    while (tabs) {
      if (tabs.getState()?.type === "tab") break;
      current = tabs;
      tabs = current.getParent();
    }
    tabs?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      tabs?.setOptions({ tabBarStyle: tabBarStyleForInsets(bottomChrome) });
    };
  }, [bottomChrome, navigation]);

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
  const myId = meQuery.data?.id;
  const editingMessage = messages.find((item) => item.id === editingId);

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
        if (mode === "group" && "threadId" in event && event.threadId) {
          void listQuery.refetch();
        } else {
          void catchUp();
        }
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
    if (mode === "thread" && threadId) {
      const readSeq =
        maxSeq > 0
          ? maxSeq
          : Number(threadQuery.data?.lastActivitySeq ?? 0);
      if (readSeq > 0) {
        void authed((token) =>
          api.markThreadRead(token, threadId, readSeq)
        ).catch(() => {});
      }
    }
    if (mode === "group" && circleId && maxSeq > 0) {
      void authed((token) =>
        api.markGroupChatRead(token, circleId, { lastReadMessageSeq: maxSeq })
      ).catch(() => {});
    }
  }, [circleId, maxSeq, mode, threadId, threadQuery.data]);

  const canReply =
    mode === "group"
      ? true
      : Boolean(threadQuery.data?.access.canReply);

  const mediaBusy = pendingMedia.some((item) => item.status === "uploading");
  const docsBusy = documentsBusy(pendingDocs);
  const hasFailedAttachment =
    pendingMedia.some((item) => item.status === "failed") ||
    pendingDocs.some(
      (item) => item.status === "failed" || item.status === "blocked"
    );
  const readyMedia = pendingMedia.filter((item) => item.status === "ready");
  const readyDocs = pendingDocs.filter((item) => item.status === "clean");
  const hasAttachments = pendingMedia.length > 0 || pendingDocs.length > 0;
  const attachmentsReady =
    hasAttachments &&
    !mediaBusy &&
    !docsBusy &&
    !hasFailedAttachment &&
    readyMedia.length + readyDocs.length ===
      pendingMedia.length + pendingDocs.length;

  async function uploadChatMedia(token: string, item: PendingChatMedia) {
    try {
      const { sizeBytes, body } = await resolveMediaBytes(
        item.uri,
        item.fileName,
        item.fileSize
      );
      const upload = await api.createMediaUpload(token, {
        fileName: item.fileName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        sizeBytes,
        purpose: "chat",
      });
      await uploadMediaBytes(
        upload.uploadUrl,
        body,
        item.mimeType,
        item.fileName
      );
      setPendingMedia((current) =>
        current.map((row) =>
          row.localId === item.localId
            ? { ...row, storageKey: upload.storageKey, status: "ready" }
            : row
        )
      );
    } catch (error) {
      setPendingMedia((current) =>
        current.map((row) =>
          row.localId === item.localId
            ? {
                ...row,
                status: "failed",
                reason:
                  error instanceof Error
                    ? error.message
                    : "Upload failed — retry or remove",
              }
            : row
        )
      );
    }
  }

  async function pickChatMedia() {
    setAttachSheetOpen(false);
    if (Platform.OS === "ios") {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setActionError("Photos permission is required to attach media.");
        return;
      }
    }
    const remaining = MAX_CHAT_MEDIA - pendingMedia.length;
    if (remaining <= 0) {
      setActionError(`A message can include up to ${MAX_CHAT_MEDIA} photos or videos`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (result.canceled) return;

    const selected: PendingChatMedia[] = [];
    for (const [index, asset] of result.assets.entries()) {
      if (asset.type !== "image" && asset.type !== "video") continue;
      const mediaType = asset.type === "video" ? "video" : "image";
      const fileName =
        asset.fileName ??
        `${mediaType}-${Date.now()}-${index}.${mediaType === "video" ? "mp4" : "jpg"}`;
      const uri = await persistPickedMediaUri(asset.uri, fileName);
      selected.push({
        localId: `${Date.now()}-${index}-${fileName}`,
        uri,
        fileName,
        mediaType,
        mimeType:
          asset.mimeType ??
          (mediaType === "video" ? "video/mp4" : "image/jpeg"),
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
        durationMs: asset.duration ?? undefined,
        status: "uploading",
      });
    }
    if (selected.length === 0) return;
    setPendingMedia((current) =>
      [...current, ...selected].slice(0, MAX_CHAT_MEDIA)
    );
    setActionError(null);
    const token = await getToken();
    if (!token) return;
    for (const item of selected) {
      void uploadChatMedia(token, item);
    }
  }

  async function pickChatDocs() {
    setAttachSheetOpen(false);
    const remaining = MAX_POST_DOCUMENTS - pendingDocs.length;
    if (remaining <= 0) {
      setActionError(`A message can include up to ${MAX_POST_DOCUMENTS} documents`);
      return;
    }
    try {
      const picked = await pickDocuments(remaining);
      if (picked.length === 0) return;
      setPendingDocs((current) =>
        [...current, ...picked].slice(0, MAX_POST_DOCUMENTS)
      );
      setActionError(null);
      await authed(async (token) => {
        for (const doc of picked) {
          if (doc.status !== "uploading") continue;
          await uploadAndScanDocument(token, doc, (next) => {
            setPendingDocs((current) =>
              current.map((item) =>
                item.localId === next.localId ? next : item
              )
            );
          });
        }
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not attach document"
      );
    }
  }

  async function send() {
    const body = draft.trim();
    const canSendAttachments = attachmentsReady && !editingId;
    if ((!body && !canSendAttachments) || sending) return;
    if (hasFailedAttachment || mediaBusy || docsBusy) return;
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
      const attachments = [
        ...readyMedia.map((item) => ({
          storageKey: item.storageKey as string,
          mediaType: item.mediaType,
          mimeType: item.mimeType,
          fileName: item.fileName,
          width: item.width,
          height: item.height,
          durationMs: item.durationMs,
        })),
        ...readyDocs.map((item) => ({
          storageKey: item.storageKey as string,
          mediaType: "document" as const,
          mimeType: item.mimeType,
          fileName: item.fileName,
        })),
      ];
      await authed((token) =>
        mode === "thread" && threadId
          ? api.sendThreadMessage(token, threadId, {
              body,
              clientMessageId: randomUUID(),
              attachments: attachments.length > 0 ? attachments : undefined,
            })
          : api.sendGroupMessage(token, circleId!, {
              body,
              clientMessageId: randomUUID(),
              replyToMessageId: quoteTarget?.id,
              attachments: attachments.length > 0 ? attachments : undefined,
            })
      );
      setDraft("");
      setQuoteTarget(null);
      setPendingMedia([]);
      setPendingDocs([]);
      await catchUp();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not send message"
      );
    } finally {
      setSending(false);
    }
  }

  async function reportMessage(message: ChatMessage) {
    setSheetMessage(null);
    Alert.alert("Report message", "Why are you reporting this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Spam",
        onPress: () =>
          void authed((token) =>
            api.reportChatMessage(token, message.circleId, message.id, "spam")
          )
            .then(() => Alert.alert("Reported", "Thanks — we’ll review this."))
            .catch((error) =>
              setActionError(
                error instanceof Error ? error.message : "Could not report"
              )
            ),
      },
      {
        text: "Inappropriate",
        onPress: () =>
          void authed((token) =>
            api.reportChatMessage(
              token,
              message.circleId,
              message.id,
              "inappropriate"
            )
          )
            .then(() => Alert.alert("Reported", "Thanks — we’ll review this."))
            .catch((error) =>
              setActionError(
                error instanceof Error ? error.message : "Could not report"
              )
            ),
      },
      {
        text: "Harassment",
        onPress: () =>
          void authed((token) =>
            api.reportChatMessage(
              token,
              message.circleId,
              message.id,
              "harassment"
            )
          )
            .then(() => Alert.alert("Reported", "Thanks — we’ll review this."))
            .catch((error) =>
              setActionError(
                error instanceof Error ? error.message : "Could not report"
              )
            ),
      },
    ]);
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

  async function openThread(message: ChatMessage) {
    if (!circleId || message.status !== "visible") return;
    const existing = message.sideThreadId;
    if (existing) {
      router.push({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: existing },
      });
      return;
    }
    const result = await authed((token) =>
      api.ensureMessageThread(token, circleId, message.id)
    );
    router.push({
      pathname: "/(app)/messages/threads/[threadId]",
      params: { threadId: result.threadId },
    });
  }

  async function toggleMute() {
    if (!threadId) return;
    const muted = threadQuery.data?.muted === true;
    await authed((token) =>
      muted ? api.unmuteThread(token, threadId) : api.muteThread(token, threadId)
    );
    await threadQuery.refetch();
  }

  async function react(message: ChatMessage, reaction: string) {
    if (message.status !== "visible") return;
    const mine = message.reactions?.some(
      (item) => item.reaction === reaction && item.mine
    );
    await authed((token) =>
      mine
        ? api.removeMessageReaction(token, message.circleId, message.id, reaction)
        : api.addMessageReaction(token, message.circleId, message.id, reaction)
    );
    await listQuery.refetch();
  }

  async function remove(message: ChatMessage) {
    await authed((token) =>
      api.deleteCircleMessage(token, message.circleId, message.id)
    );
    await listQuery.refetch();
  }

  function openSheet(message: ChatMessage, nextMode: "react" | "more") {
    if (message.status !== "visible") return;
    setSheetMode(nextMode);
    setSheetMessage(message);
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setDraft(message.body ?? "");
    setQuoteTarget(null);
    setSheetMessage(null);
  }

  if (listQuery.isLoading || (mode === "thread" && threadQuery.isLoading)) {
    return <ScreenLoader label="Loading chat" />;
  }

  if (mode === "thread" && (threadQuery.isError || listQuery.isError)) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="This thread is no longer available"
        message="It may have been closed, removed, or your access was revoked."
      />
    );
  }

  if (mode === "group" && listQuery.isError) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not open this group"
        message="Check your connection and try again."
      />
    );
  }

  const dockStyle =
    androidDockOffset > 0 ? { marginBottom: androidDockOffset } : null;
  const composerPad =
    keyboardHeight > 0 ? spacing.xs : Math.max(bottomChrome, spacing.sm);
  const canSend =
    !sending &&
    canReply &&
    !mediaBusy &&
    !docsBusy &&
    !hasFailedAttachment &&
    (editingId
      ? Boolean(draft.trim())
      : Boolean(draft.trim()) || attachmentsReady);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
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
            <Text style={styles.meta}>
              {threadQuery.data.circleName}
              {threadQuery.data.access.grantRole === "guest_author"
                ? " · Guest question"
                : ""}
            </Text>
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
        style={styles.listFlex}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No messages yet"
            message={
              mode === "group"
                ? "Start a conversation. Use the thread icon on a message to keep a side discussion together."
                : "Say hello — this is the start of the conversation."
            }
          />
        }
        renderItem={({ item }) => (
          <Bubble
            message={item}
            mine={item.author.userId === myId}
            highlight={item.id === editingId}
            onLike={() => void react(item, "👍")}
            onOpenReact={() => openSheet(item, "react")}
            onOpenMore={() => openSheet(item, "more")}
            onReact={(reaction) => void react(item, reaction)}
            showThreadActions={mode === "group"}
            onThread={() => void openThread(item)}
            onQuote={() => {
              if (item.status !== "visible") return;
              setQuoteTarget(item);
              setEditingId(null);
            }}
          />
        )}
      />
      {canReply ? (
        <View style={[styles.composer, dockStyle, { paddingBottom: composerPad }]}>
          {actionError ? (
            <Text style={styles.actionError}>{actionError}</Text>
          ) : null}
          {editingId ? (
            <View style={styles.editBanner}>
              <View style={styles.editAccent} />
              <View style={styles.editCopy}>
                <Text style={styles.editTitle}>Editing message</Text>
                <Text style={styles.editPreview} numberOfLines={1}>
                  {editingMessage?.body ?? draft}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setEditingId(null);
                  setDraft("");
                }}
                hitSlop={10}
                accessibilityLabel="Cancel edit"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {quoteTarget && !editingId ? (
            <View style={styles.editBanner}>
              <View style={styles.editAccent} />
              <View style={styles.editCopy}>
                <Text style={styles.editTitle}>Reply in channel</Text>
                <Text style={styles.editPreview} numberOfLines={1}>
                  {attachmentQuoteLabel(
                    quoteTarget.attachments,
                    quoteTarget.body
                  )}
                </Text>
              </View>
              <Pressable
                onPress={() => setQuoteTarget(null)}
                hitSlop={10}
                accessibilityLabel="Cancel channel reply"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {!editingId && hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.attachTray}
              contentContainerStyle={styles.attachTrayContent}
            >
              {pendingMedia.map((item) => (
                <View key={item.localId} style={styles.attachThumbWrap}>
                  {item.mediaType === "image" ? (
                    <Image source={{ uri: item.uri }} style={styles.attachThumb} />
                  ) : (
                    <View style={[styles.attachThumb, styles.attachVideo]}>
                      <Ionicons name="play" size={16} color={colors.textInverse} />
                    </View>
                  )}
                  {item.status === "uploading" ? (
                    <View style={styles.attachBusy}>
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    </View>
                  ) : null}
                  {item.status === "failed" ? (
                    <Pressable
                      style={styles.attachRetry}
                      onPress={() => {
                        void getToken().then((token) => {
                          if (!token) return;
                          setPendingMedia((current) =>
                            current.map((row) =>
                              row.localId === item.localId
                                ? { ...row, status: "uploading", reason: undefined }
                                : row
                            )
                          );
                          void uploadChatMedia(token, {
                            ...item,
                            status: "uploading",
                          });
                        });
                      }}
                    >
                      <Text style={styles.attachRetryLabel}>Retry</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.attachRemove}
                    onPress={() =>
                      setPendingMedia((current) =>
                        current.filter((row) => row.localId !== item.localId)
                      )
                    }
                    accessibilityLabel="Remove attachment"
                  >
                    <Ionicons name="close-circle" size={20} color={colors.text} />
                  </Pressable>
                </View>
              ))}
              {pendingDocs.map((item) => (
                <View key={item.localId} style={styles.attachDocChip}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primaryDark} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.attachDocName} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    <Text style={styles.attachDocStatus} numberOfLines={1}>
                      {item.status === "scanning"
                        ? "Checking file…"
                        : item.status === "uploading"
                          ? "Uploading…"
                          : item.status === "clean"
                            ? "Ready"
                            : item.reason ?? "Failed"}
                    </Text>
                  </View>
                  {(item.status === "failed" || item.status === "blocked") &&
                  item.uri ? (
                    <Pressable
                      onPress={() => {
                        void authed(async (token) => {
                          setPendingDocs((current) =>
                            current.map((row) =>
                              row.localId === item.localId
                                ? { ...row, status: "uploading", reason: undefined }
                                : row
                            )
                          );
                          await uploadAndScanDocument(
                            token,
                            { ...item, status: "uploading" },
                            (next) => {
                              setPendingDocs((current) =>
                                current.map((row) =>
                                  row.localId === next.localId ? next : row
                                )
                              );
                            }
                          );
                        });
                      }}
                    >
                      <Text style={styles.attachRetryLabel}>Retry</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() =>
                      setPendingDocs((current) =>
                        current.filter((row) => row.localId !== item.localId)
                      )
                    }
                    accessibilityLabel="Remove document"
                  >
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.inputRow}>
            {!editingId ? (
              <Pressable
                style={styles.attachBtn}
                onPress={() => setAttachSheetOpen(true)}
                accessibilityLabel="Add attachment"
              >
                <Ionicons name="add" size={26} color={colors.primaryDark} />
              </Pressable>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder={
                editingId
                  ? "Update message"
                  : hasAttachments
                    ? "Add a note…"
                    : "Message"
              }
              placeholderTextColor={colors.textSubtle}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <Pressable
              style={[styles.send, !canSend && styles.sendDisabled]}
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityLabel={editingId ? "Save message" : "Send message"}
            >
              <Ionicons
                name={editingId ? "checkmark" : "send"}
                size={18}
                color={colors.textInverse}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={[styles.readonly, dockStyle, { paddingBottom: composerPad }]}>
          You can read this thread, not reply.
        </Text>
      )}

      <Modal
        visible={attachSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachSheetOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setAttachSheetOpen(false)}
        >
          <Pressable
            style={[styles.attachSheet, { paddingBottom: Math.max(bottomChrome, spacing.md) }]}
            onPress={() => {}}
          >
            <View style={styles.attachChoices}>
              <Pressable
                style={styles.attachChoice}
                onPress={() => void pickChatMedia()}
                accessibilityLabel="Photos and videos"
              >
                <View style={styles.attachChoiceIcon}>
                  <Ionicons name="images" size={26} color={colors.primaryDark} />
                </View>
                <Text style={styles.attachChoiceLabel}>Photos & videos</Text>
              </Pressable>
              <Pressable
                style={styles.attachChoice}
                onPress={() => void pickChatDocs()}
                accessibilityLabel="Document"
              >
                <View style={styles.attachChoiceIcon}>
                  <Ionicons
                    name="document-text"
                    size={26}
                    color={colors.primaryDark}
                  />
                </View>
                <Text style={styles.attachChoiceLabel}>Document</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <MessageActionSheet
        message={sheetMessage}
        mode={sheetMode}
        mine={sheetMessage?.author.userId === myId}
        onClose={() => setSheetMessage(null)}
        onReact={(reaction) => {
          if (!sheetMessage) return;
          void react(sheetMessage, reaction);
          setSheetMessage(null);
        }}
        onEdit={() => {
          if (sheetMessage) startEdit(sheetMessage);
        }}
        onDelete={() => {
          if (!sheetMessage) return;
          setPendingDelete(sheetMessage);
          setSheetMessage(null);
        }}
        onReport={() => {
          if (sheetMessage) void reportMessage(sheetMessage);
        }}
      />

      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade">
        <Pressable style={styles.confirmBackdrop} onPress={() => setPendingDelete(null)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Delete this message?</Text>
            <Text style={styles.confirmBody}>
              Everyone in this chat will see it as deleted.
            </Text>
            <Pressable
              style={styles.confirmDelete}
              onPress={() => {
                if (!pendingDelete) return;
                void remove(pendingDelete);
                setPendingDelete(null);
              }}
            >
              <Text style={styles.confirmDeleteLabel}>Delete</Text>
            </Pressable>
            <Pressable
              style={styles.confirmCancel}
              onPress={() => setPendingDelete(null)}
            >
              <Text style={styles.confirmCancelLabel}>Keep message</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  mine,
  highlight,
  onLike,
  onOpenReact,
  onOpenMore,
  onReact,
  showThreadActions,
  onThread,
  onQuote,
}: {
  message: ChatMessage;
  mine: boolean;
  highlight: boolean;
  onLike: () => void;
  onOpenReact: () => void;
  onOpenMore: () => void;
  onReact: (reaction: string) => void;
  showThreadActions: boolean;
  onThread: () => void;
  onQuote: () => void;
}) {
  const reactions = message.reactions?.filter((item) => item.count > 0) ?? [];
  const visible = message.status === "visible";
  const liked = message.reactions?.some(
    (item) => item.reaction === "👍" && item.mine
  );
  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  const canManage = mine && ageMs <= 24 * 60 * 60 * 1000;
  const canReport = !mine && visible;
  const role =
    message.author.role === "provider"
      ? "Tutor"
      : message.author.isGuest
        ? "Guest"
        : null;

  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      {!mine ? (
        <Avatar
          handle={message.author.displayName}
          avatarKey={message.author.avatarKey}
          size={32}
        />
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <View style={[styles.stack, mine && styles.stackMine]}>
        {!mine ? (
          <Text style={styles.author} numberOfLines={1}>
            {message.author.displayName}
            {role ? ` · ${role}` : ""}
          </Text>
        ) : null}
        <Pressable
          onLongPress={onOpenReact}
          delayLongPress={320}
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheir,
            highlight && styles.bubbleEditing,
            !visible && styles.bubbleDeleted,
          ]}
        >
          {visible ? (
            <ChatMessageAttachments
              attachments={message.attachments}
              mine={mine}
            />
          ) : null}
          {visible && message.body ? (
            <Text style={[styles.body, mine && styles.bodyMine]}>
              {message.body}
            </Text>
          ) : null}
          {!visible ? (
            <Text style={[styles.body, styles.bodyDeleted]}>Message deleted</Text>
          ) : null}
          {visible && !message.body && !(message.attachments?.length) ? (
            <Text style={[styles.body, mine && styles.bodyMine]}> </Text>
          ) : null}
          <Text style={[styles.time, mine && visible && styles.timeMine]}>
            {message.editedAt && visible ? "edited · " : ""}
            {formatTime(message.createdAt)}
          </Text>
        </Pressable>
        {visible ? (
          <View style={[styles.quickActions, mine && styles.quickActionsMine]}>
            {showThreadActions ? (
              <>
                <Pressable
                  onPress={onThread}
                  style={styles.actionBtn}
                  accessibilityLabel={
                    (message.replyCount ?? 0) > 0
                      ? `${message.replyCount} replies`
                      : "Reply in thread"
                  }
                >
                  <Ionicons
                    name={
                      (message.replyCount ?? 0) > 0
                        ? "chatbubbles"
                        : "chatbubbles-outline"
                    }
                    size={16}
                    color={
                      (message.replyCount ?? 0) > 0
                        ? colors.primaryDark
                        : colors.textMuted
                    }
                  />
                  {(message.replyCount ?? 0) > 0 ? (
                    <Text style={[styles.actionLabel, styles.actionLabelOn]}>
                      {message.replyCount}
                    </Text>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={onQuote}
                  style={styles.actionBtn}
                  accessibilityLabel="Reply in channel"
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={onLike}
              style={styles.actionBtn}
              accessibilityLabel="Like"
            >
              <Ionicons
                name={liked ? "thumbs-up" : "thumbs-up-outline"}
                size={15}
                color={liked ? colors.primaryDark : colors.textMuted}
              />
              <Text style={[styles.actionLabel, liked && styles.actionLabelOn]}>
                Like
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenReact}
              style={styles.actionBtn}
              accessibilityLabel="React"
            >
              <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
              <Text style={styles.actionLabel}>React</Text>
            </Pressable>
            {canManage || canReport ? (
              <Pressable
                onPress={onOpenMore}
                style={styles.actionBtn}
                accessibilityLabel="More"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={16}
                  color={colors.textMuted}
                />
                <Text style={styles.actionLabel}>More</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showThreadActions &&
        visible &&
        (message.replyCount ?? 0) > 0 &&
        message.lastReplyPreview ? (
          <Pressable
            onPress={onThread}
            accessibilityLabel={`${message.replyCount} replies`}
          >
            <Text
              style={[styles.threadPreview, mine && styles.threadPreviewMine]}
              numberOfLines={1}
            >
              {message.lastReplyPreview}
            </Text>
          </Pressable>
        ) : null}
        {reactions.length > 0 ? (
          <View style={[styles.reactRow, mine && styles.reactRowMine]}>
            {reactions.map((item) => (
              <Pressable
                key={item.reaction}
                onPress={() => onReact(item.reaction)}
                style={[styles.reactChip, item.mine && styles.reactChipMine]}
              >
                <Text style={styles.reactLabel}>
                  {item.reaction} {item.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {mine ? (
        <Avatar
          handle={message.author.displayName}
          avatarKey={message.author.avatarKey}
          size={32}
        />
      ) : null}
    </View>
  );
}

function MessageActionSheet({
  message,
  mode,
  mine,
  onClose,
  onReact,
  onEdit,
  onDelete,
  onReport,
}: {
  message: ChatMessage | null;
  mode: "react" | "more";
  mine: boolean;
  onClose: () => void;
  onReact: (reaction: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  if (!message) return null;
  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  const canEdit = mine && ageMs <= 15 * 60 * 1000;
  const canDelete = mine && ageMs <= 24 * 60 * 60 * 1000;
  const canReport = !mine;
  const showReact = mode === "react";
  const showMore = mode === "more" && (canEdit || canDelete || canReport);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {showReact ? (
            <>
              <Text style={styles.sheetTitle}>React</Text>
              <View style={styles.emojiBar}>
                {QUICK_REACTIONS.map((emoji) => {
                  const active = message.reactions?.some(
                    (item) => item.reaction === emoji && item.mine
                  );
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => onReact(emoji)}
                      style={[styles.emojiBtn, active && styles.emojiBtnActive]}
                      accessibilityLabel={`React ${emoji}`}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {showMore ? (
            <View style={styles.sheetActions}>
              <Text style={styles.sheetTitle}>
                {mine ? "Your message" : "Message"}
              </Text>
              {canEdit ? (
                <Pressable style={styles.sheetAction} onPress={onEdit}>
                  <View style={styles.sheetIcon}>
                    <Ionicons name="pencil" size={16} color={colors.primaryDark} />
                  </View>
                  <View>
                    <Text style={styles.sheetActionLabel}>Edit</Text>
                    <Text style={styles.sheetHint}>Up to 15 minutes after sending</Text>
                  </View>
                </Pressable>
              ) : null}
              {canDelete ? (
                <Pressable style={styles.sheetAction} onPress={onDelete}>
                  <View style={[styles.sheetIcon, styles.sheetIconDanger]}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </View>
                  <View>
                    <Text style={[styles.sheetActionLabel, styles.sheetActionDanger]}>
                      Delete
                    </Text>
                    <Text style={styles.sheetHint}>
                      Everyone in the group will see it as deleted
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              {canReport ? (
                <Pressable style={styles.sheetAction} onPress={onReport}>
                  <View style={[styles.sheetIcon, styles.sheetIconDanger]}>
                    <Ionicons name="flag-outline" size={16} color={colors.error} />
                  </View>
                  <View>
                    <Text style={[styles.sheetActionLabel, styles.sheetActionDanger]}>
                      Report
                    </Text>
                    <Text style={styles.sheetHint}>
                      Flag inappropriate text or attachments
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listFlex: { flex: 1 },
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
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 20 },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  rowMine: { justifyContent: "flex-end" },
  avatarSpacer: { width: 32 },
  stack: { maxWidth: "74%", alignItems: "flex-start" },
  stackMine: { alignItems: "flex-end" },
  author: {
    fontFamily: typography.semibold,
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: "100%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleTheir: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 6,
    ...shadows.card,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleEditing: {
    borderWidth: 1.5,
    borderColor: colors.amber,
  },
  bubbleDeleted: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    fontFamily: typography.regular,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bodyMine: { color: colors.textInverse },
  bodyDeleted: {
    fontFamily: typography.medium,
    color: colors.textSubtle,
    fontStyle: "italic",
  },
  time: {
    marginTop: 4,
    alignSelf: "flex-end",
    fontFamily: typography.regular,
    color: colors.textSubtle,
    fontSize: 10,
  },
  timeMine: { color: "rgba(255,255,255,0.78)" },
  reactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: -8,
    marginLeft: 8,
  },
  reactRowMine: { marginLeft: 0, marginRight: 8, justifyContent: "flex-end" },
  reactChip: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  reactChipMine: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySoft,
  },
  reactLabel: { fontFamily: typography.medium, fontSize: 12, color: colors.text },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  quickActionsMine: { marginLeft: 0, marginRight: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  actionLabel: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  actionLabelOn: { color: colors.primaryDark },
  threadPreview: {
    marginTop: 4,
    marginLeft: 4,
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    maxWidth: 220,
  },
  threadPreviewMine: { marginLeft: 0, marginRight: 4, textAlign: "right" },
  askBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  attachTray: {
    maxHeight: 88,
    marginBottom: 8,
  },
  attachTrayContent: {
    gap: 8,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  attachThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
  },
  attachThumb: {
    width: 72,
    height: 72,
    backgroundColor: colors.border,
  },
  attachVideo: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  attachBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  attachRetry: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  attachRetryLabel: {
    color: colors.textInverse,
    fontFamily: typography.semibold,
    fontSize: 11,
  },
  attachRemove: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  attachDocChip: {
    width: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachDocName: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 12,
  },
  attachDocStatus: {
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 11,
  },
  attachSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  attachChoices: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
  },
  attachChoice: {
    width: 108,
    alignItems: "center",
    gap: 8,
  },
  attachChoiceIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  attachChoiceLabel: {
    fontFamily: typography.medium,
    color: colors.text,
    fontSize: 12,
    textAlign: "center",
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  editAccent: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  editCopy: { flex: 1 },
  editTitle: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
    fontSize: 12,
  },
  editPreview: {
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: typography.regular,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.35 },
  readonly: {
    textAlign: "center",
    padding: spacing.md,
    color: colors.textMuted,
  },
  actionError: {
    color: colors.error,
    fontFamily: typography.medium,
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(13,27,42,0.45)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,27,42,0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.floating,
  },
  sheetTitle: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 15,
    marginBottom: 10,
  },
  sheetHint: {
    fontFamily: typography.regular,
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  emojiBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnActive: { backgroundColor: colors.primarySoft },
  emoji: { fontSize: 24 },
  sheetActions: {
    marginTop: 12,
    gap: 6,
  },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconDanger: { backgroundColor: colors.errorSoft },
  sheetActionLabel: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 16,
  },
  sheetActionDanger: { color: colors.error },
  confirmCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.floating,
  },
  confirmTitle: {
    fontFamily: typography.bold,
    color: colors.text,
    fontSize: 18,
  },
  confirmBody: {
    marginTop: 8,
    fontFamily: typography.regular,
    color: colors.textMuted,
    lineHeight: 20,
  },
  confirmDelete: {
    marginTop: 18,
    backgroundColor: colors.error,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmDeleteLabel: {
    fontFamily: typography.semibold,
    color: colors.textInverse,
  },
  confirmCancel: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  confirmCancelLabel: {
    fontFamily: typography.semibold,
    color: colors.textMuted,
  },
});
