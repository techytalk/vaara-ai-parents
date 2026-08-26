import { useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthorRow,
  cardShadow,
  formatPostTime,
  PostMediaGallery,
  PostTagBadge,
  ScreenLoader,
  theme,
} from "@/components/circles/ui";
import { api, type CircleAuthor, type CirclePost } from "@/lib/api";
import { getToken } from "@/lib/session";

type Reply = {
  id: string;
  body: string;
  createdAt: string;
  author: CircleAuthor;
};

function ReplyCard({ reply }: { reply: Reply }) {
  return (
    <View style={styles.replyRow}>
      <View style={styles.replyLine} />
      <View style={[styles.replyCard, cardShadow()]}>
        <AuthorRow
          handle={reply.author.anonymousHandle}
          contextLabel={reply.author.contextLabel}
          timestamp={reply.createdAt}
          size="sm"
        />
        <Text style={styles.replyBody}>{reply.body}</Text>
        <Text style={styles.replyTime}>{formatPostTime(reply.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function PostThreadScreen() {
  const { circleId, postId } = useLocalSearchParams<{
    circleId: string;
    postId: string;
  }>();
  const router = useRouter();
  const [post, setPost] = useState<CirclePost | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const data = await api.getPost(token, circleId, postId);
        setPost(data.post);
        setReplies(data.replies);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    });
  }, [circleId, postId]);

  async function onReply() {
    const text = replyText.trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const reply = await api.addReply(token, circleId, postId, text);
      setReplies((prev) => [...prev, reply]);
      setReplyText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reply");
    } finally {
      setSubmitting(false);
    }
  }

  async function onMessageAuthor() {
    if (!post) return;
    const token = await getToken();
    if (!token) return;
    try {
      const conv = await api.startConversation(token, {
        peerUserId: post.author.userId,
        circleId,
        postId,
      });
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: {
          conversationId: conv.id,
          peerHandle: conv.peer.anonymousHandle,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not message");
    }
  }

  if (loading) {
    return <ScreenLoader />;
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>{error ?? "Post not found"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={[styles.postCard, cardShadow()]}>
              <View style={styles.postAccent} />
              <View style={styles.postInner}>
                <AuthorRow
                  handle={post.author.anonymousHandle}
                  contextLabel={post.author.contextLabel}
                  timestamp={post.createdAt}
                />
                <View style={styles.postContent}>
                  <PostTagBadge tag={post.tag} />
                  {post.body ? (
                    <Text style={styles.postBody}>{post.body}</Text>
                  ) : null}
                </View>
                <PostMediaGallery media={post.media ?? []} />
                <Pressable style={styles.messageBtn} onPress={onMessageAuthor}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={styles.messageBtnText}>Message parent</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.repliesHeader}>
              <Text style={styles.repliesTitle}>
                Replies
                {replies.length > 0 ? ` (${replies.length})` : ""}
              </Text>
              {replies.length === 0 ? (
                <Text style={styles.repliesHint}>
                  Be the first to respond to this post
                </Text>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item }) => <ReplyCard reply={item} />}
        ListEmptyComponent={
          replies.length === 0 ? (
            <View style={styles.noReplies}>
              <Ionicons
                name="chatbubble-outline"
                size={28}
                color={theme.textMuted}
              />
              <Text style={styles.noRepliesText}>No replies yet</Text>
            </View>
          ) : null
        }
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.composer, cardShadow()]}>
        <TextInput
          style={styles.composerInput}
          placeholder="Write a helpful reply…"
          placeholderTextColor={theme.textMuted}
          value={replyText}
          onChangeText={setReplyText}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!replyText.trim() || submitting) && styles.sendBtnDisabled,
          ]}
          onPress={onReply}
          disabled={submitting || !replyText.trim()}
        >
          {submitting ? (
            <Ionicons name="hourglass-outline" size={20} color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },
  notFound: { color: theme.textMuted, fontSize: 15 },
  listContent: { padding: 16, paddingBottom: 8 },
  postCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  postAccent: {
    height: 4,
    backgroundColor: theme.primary,
  },
  postInner: { padding: 16 },
  postContent: {
    marginTop: 14,
    gap: 12,
  },
  postBody: {
    fontSize: 17,
    color: theme.text,
    lineHeight: 26,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
  },
  messageBtnText: {
    color: theme.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  repliesHeader: {
    marginBottom: 12,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },
  repliesHint: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  replyRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  replyLine: {
    width: 3,
    backgroundColor: theme.border,
    marginLeft: 8,
    marginRight: 12,
    borderRadius: 2,
  },
  replyCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  replyBody: {
    fontSize: 15,
    color: theme.text,
    marginTop: 10,
    lineHeight: 22,
  },
  replyTime: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 8,
  },
  noReplies: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noRepliesText: {
    fontSize: 14,
    color: theme.textMuted,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
  },
  errorText: { color: theme.error, fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  composerInput: {
    flex: 1,
    backgroundColor: theme.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.text,
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
