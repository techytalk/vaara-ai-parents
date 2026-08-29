import { useCallback, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthorRow,
  cardShadow,
  formatPostTime,
  PollCard,
  PostMediaGallery,
  PostTagBadge,
  ScreenLoader,
  theme,
} from "@/components/circles/ui";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, type CirclePost, type PostComment } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/session";

function CommentCard({ comment }: { comment: PostComment }) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentLine} />
      <View style={[styles.commentCard, cardShadow()]}>
        <AuthorRow
          handle={comment.author.anonymousHandle}
          avatarKey={comment.author.avatarKey}
          contextLabel={comment.author.contextLabel}
          timestamp={comment.createdAt}
          size="sm"
        />
        <Text style={styles.commentBody}>{comment.body}</Text>
        <Text style={styles.commentTime}>
          {formatPostTime(comment.createdAt)}
        </Text>
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
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [post, setPost] = useState<CirclePost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [saved, setSaved] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const user = await getStoredUser();
    setCurrentUserId(user?.id ?? null);
    try {
      const [data, savedData] = await Promise.all([
        api.getPost(token, circleId, postId),
        api.getSaved(token).catch(() => ({ posts: [] })),
      ]);
      setPost(data.post);
      setComments(data.replies);
      setSaved(savedData.posts.some((item) => item.id === postId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [circleId, postId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeChannel({
    channel: circleId ? `circle:${circleId}` : null,
    onEvent: (event) => {
      if (event.type === "reply.new" && event.postId === postId) {
        load();
      }
    },
    onPollFallback: load,
  });

  useLayoutEffect(() => {
    const isOwnPost =
      Boolean(currentUserId) && post?.author.userId === currentUserId;
    navigation.setOptions({
      title: "Post",
      headerRight: () => (
        <View style={styles.headerActions}>
          {isOwnPost ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={8}
              style={styles.headerDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete post"
              disabled={deleting}
            >
              <Ionicons name="trash-outline" size={22} color={theme.error} />
            </Pressable>
          ) : null}
          <Pressable onPress={toggleSave} hitSlop={8} style={styles.headerSave}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={theme.primary}
            />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, saved, currentUserId, post, deleting]);

  function confirmDelete() {
    Alert.alert(
      "Delete post?",
      "This will permanently remove your post and its comments.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void onDelete() },
      ]
    );
  }

  async function onDelete() {
    const token = await getToken();
    if (!token) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deletePost(token, circleId, postId);
      queryClient.setQueryData(
        ["circleFeed", circleId],
        (current: { posts: CirclePost[]; memberCount: number } | undefined) =>
          current
            ? {
                ...current,
                posts: current.posts.filter((item) => item.id !== postId),
              }
            : current
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleSave() {
    const token = await getToken();
    if (!token) return;
    try {
      if (saved) {
        await api.unsaveItem(token, "post", postId);
        setSaved(false);
      } else {
        await api.saveItem(token, { itemType: "post", itemId: postId });
        setSaved(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update save"
      );
    }
  }

  async function toggleHelpful() {
    const token = await getToken();
    if (!token || !post) return;
    try {
      const result = await api.togglePostHelpful(token, postId);
      setPost({
        ...post,
        myHelpful: result.helpful,
        helpfulCount: result.helpfulCount,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update helpful"
      );
    }
  }

  async function onComment() {
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        const message = "Your session expired. Please sign in again.";
        setError(message);
        Alert.alert("Could not comment", message);
        return;
      }
      const comment = await api.addReply(token, circleId, postId, text);
      setComments((prev) => [...prev, comment]);
      setCommentText("");
      setPost((current) =>
        current
          ? { ...current, replyCount: current.replyCount + 1 }
          : current
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to comment";
      setError(message);
      Alert.alert("Could not comment", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSharePost() {
    if (!post) return;
    const preview = post.body.trim() || post.poll?.question || "A parent post";
    try {
      await Share.share({ message: `${preview}\n\n— via Vaara Parents` });
    } catch {
      // user dismissed the share sheet
    }
  }

  async function onMessageAuthor() {
    if (!post) return;
    const token = await getToken();
    if (!token) {
      Alert.alert("Could not message", "Your session expired. Please sign in again.");
      return;
    }
    try {
      let peerUserId = post.authorId ?? post.author.userId;
      if (!peerUserId) {
        const members = await api.getCircleMembers(token, circleId);
        peerUserId =
          members.find(
            (member) =>
              member.anonymousHandle === post.author.anonymousHandle
          )?.userId ?? "";
      }
      if (!peerUserId) {
        const message = "Could not identify this parent. Try Messages instead.";
        setError(message);
        Alert.alert("Could not message", message);
        return;
      }
      if (currentUserId && peerUserId === currentUserId) {
        Alert.alert("Could not message", "You cannot message yourself.");
        return;
      }
      const conv = await api.startConversation(token, {
        peerUserId,
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
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not message";
      setError(message);
      Alert.alert("Could not message", message);
    }
  }

  async function onPollVote(optionId: string) {
    const token = await getToken();
    if (!token || !post) return;
    try {
      const { poll } = await api.votePoll(token, circleId, postId, optionId);
      if (poll) setPost({ ...post, poll });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not vote");
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

  const helpfulCount = post.helpfulCount ?? 0;
  const isOwnPost =
    Boolean(currentUserId) &&
    (post.authorId === currentUserId || post.author.userId === currentUserId);
  const canMessageAuthor =
    !isOwnPost && Boolean(post.authorId ?? post.author.userId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={[styles.postCard, cardShadow()]}>
              <View style={styles.postAccent} />
              <View style={styles.postInner}>
                <AuthorRow
                  handle={post.author.anonymousHandle}
                  avatarKey={post.author.avatarKey}
                  contextLabel={post.author.contextLabel}
                  timestamp={post.createdAt}
                />
                <View style={styles.postContent}>
                  <PostTagBadge tag={post.tag} />
                  {post.body ? (
                    <Text style={styles.postBody}>{post.body}</Text>
                  ) : null}
                </View>
                {post.poll ? (
                  <PollCard poll={post.poll} onVote={onPollVote} />
                ) : null}
                <PostMediaGallery media={post.media ?? []} />

                {helpfulCount > 0 ? (
                  <Text style={styles.engagement}>
                    {helpfulCount} parent{helpfulCount === 1 ? "" : "s"} found
                    this helpful
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    style={styles.action}
                    onPress={toggleHelpful}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={post.myHelpful ? "thumbs-up" : "thumbs-up-outline"}
                      size={18}
                      color={post.myHelpful ? theme.primary : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.actionText,
                        post.myHelpful && styles.actionTextActive,
                      ]}
                    >
                      Helpful
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.action}
                    onPress={onSharePost}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={theme.textMuted}
                    />
                    <Text style={styles.actionText}>Share</Text>
                  </Pressable>
                  {canMessageAuthor ? (
                    <Pressable
                      style={styles.action}
                      onPress={onMessageAuthor}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={18}
                        color={theme.textMuted}
                      />
                      <Text style={styles.actionText}>Message</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>
                Comments
                {comments.length > 0 ? ` (${comments.length})` : ""}
              </Text>
              {comments.length === 0 ? (
                <Text style={styles.commentsHint}>
                  Be the first to respond to this post
                </Text>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item }) => <CommentCard comment={item} />}
        ListEmptyComponent={
          <View style={styles.noComments}>
            <Ionicons
              name="chatbubble-outline"
              size={28}
              color={theme.textMuted}
            />
            <Text style={styles.noCommentsText}>No comments yet</Text>
          </View>
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
          placeholder="Write a helpful comment…"
          placeholderTextColor={theme.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!commentText.trim() || submitting) && styles.sendBtnDisabled,
          ]}
          onPress={onComment}
          disabled={submitting || !commentText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerDelete: { marginRight: 4 },
  headerSave: { marginRight: 8 },
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
  engagement: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 14,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
  },
  actionText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
  },
  actionTextActive: { color: theme.primary },
  commentsHeader: {
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },
  commentsHint: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  commentRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  commentLine: {
    width: 3,
    backgroundColor: theme.border,
    marginLeft: 8,
    marginRight: 12,
    borderRadius: 2,
  },
  commentCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  commentBody: {
    fontSize: 15,
    color: theme.text,
    marginTop: 10,
    lineHeight: 22,
  },
  commentTime: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 8,
  },
  noComments: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noCommentsText: {
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
