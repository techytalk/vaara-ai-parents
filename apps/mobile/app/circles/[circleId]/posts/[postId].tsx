import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { PostContextChips } from "@/components/circles/PostContextChips";
import { PostDocumentList } from "@/components/circles/PostDocumentList";
import { useBottomChromeInset } from "@/hooks/useBottomChromeInset";
import { useAndroidImeDockOffset } from "@/hooks/useKeyboardHeight";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { api, type AuthUser, type PostComment } from "@/lib/api";
import {
  endAuthenticatedSession,
  isUnauthorized,
} from "@/lib/authenticated-state";
import {
  appendThreadReply,
  findCachedCirclePost,
  mergeCirclePostFields,
  mergeThreadPoll,
  postThreadQueryKey,
  removePostFromFeeds,
  removePostThreadQueries,
  setSavedPostId,
  type PostThreadData,
} from "@/lib/post-cache";
import { sharePostLink, sharePostMedia } from "@/lib/share-post";
import { getStoredUser, getToken } from "@/lib/session";
import { useSubmitReport } from "@/providers/ReportProvider";

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
          isGuest={comment.author.isGuest}
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
  const { circleId, postId, shareId } = useLocalSearchParams<{
    circleId: string;
    postId: string;
    shareId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const bottomChrome = useBottomChromeInset();
  const androidDockOffset = useAndroidImeDockOffset(bottomChrome);
  const submitReport = useSubmitReport();
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authExitStartedRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => queryClient.getQueryData<AuthUser>(["sessionUser"])?.id ?? null
  );

  useEffect(() => {
    setCommentText("");
    setError(null);
  }, [circleId, postId]);

  const cachedPost = findCachedCirclePost(
    queryClient,
    circleId,
    postId,
    shareId
  );
  const threadKey = postThreadQueryKey(circleId, postId, shareId);

  const threadQuery = useQuery({
    queryKey: threadKey,
    queryFn: async (): Promise<PostThreadData> => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const data = await api.getPost(token, circleId, postId, shareId);
      return {
        post: data.post,
        replies: data.replies,
        readOnly: Boolean(data.readOnly ?? data.post.readOnly),
        capabilities: data.capabilities ?? null,
        authoritative: true,
      };
    },
    initialData: cachedPost
      ? {
          post: cachedPost,
          replies: [],
          readOnly: true,
          capabilities: null,
          authoritative: false,
        }
      : undefined,
    initialDataUpdatedAt: cachedPost ? 0 : undefined,
    retry: false,
  });

  const savedQuery = useQuery({
    queryKey: ["me", "savedPostIds"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const result = await api.getSaved(token);
      return result.posts.map((post) => post.id);
    },
    enabled:
      queryClient.getQueryData<string[]>(["me", "savedPostIds"]) !== undefined ||
      threadQuery.data?.authoritative === true,
    retry: false,
  });

  useEffect(() => {
    if (currentUserId) return;
    void getStoredUser().then((user) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, [currentUserId]);

  useEffect(() => {
    const unauthorized = [threadQuery.error, savedQuery.error].some(
      isUnauthorized
    );
    if (!unauthorized || authExitStartedRef.current) return;
    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }, [threadQuery.error, savedQuery.error, router]);

  const refreshThread = useCallback(() => {
    void threadQuery.refetch();
  }, [threadQuery]);

  useRealtimeChannel({
    channel: postId ? `post:${postId}` : null,
    onEvent: (event) => {
      if (event.type === "reply.new" && event.postId === postId) {
        queryClient.invalidateQueries({ queryKey: threadKey });
      }
    },
    onPollFallback: refreshThread,
  });

  const post = threadQuery.data?.post ?? null;
  const comments = threadQuery.data?.replies ?? [];
  const authoritative = threadQuery.data?.authoritative === true;
  const capabilities = authoritative ? threadQuery.data?.capabilities ?? null : null;
  const readOnly = authoritative ? Boolean(threadQuery.data?.readOnly) : true;
  const saved = (savedQuery.data ?? []).includes(postId);

  const showPostSafetyActions = useCallback(() => {
    if (!post) return;
    const authorId = post.authorId ?? post.author.userId;
    Alert.alert("Safety options", "Choose an action for this post.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report post",
        onPress: () => {
          submitReport({
            title: "Report post",
            submit: async (reason) => {
              const token = await getToken();
              if (!token) throw new Error("Not signed in");
              await api.reportPost(token, circleId, postId, reason);
            },
          });
        },
      },
      ...(authorId
        ? [
            {
              text: "Report parent",
              onPress: () => {
                submitReport({
                  title: `Report ${post.author.anonymousHandle}`,
                  submit: async (reason) => {
                    const token = await getToken();
                    if (!token) throw new Error("Not signed in");
                    await api.reportUser(token, authorId, reason);
                  },
                });
              },
            },
          ]
        : []),
    ]);
  }, [circleId, post, postId, submitReport]);

  const onDelete = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deletePost(token, circleId, postId);
      removePostFromFeeds(queryClient, postId, circleId, {
        removeThreadQueries: false,
      });
      router.back();
      removePostThreadQueries(queryClient, circleId, postId);
    } catch (cause) {
      if (isUnauthorized(cause)) {
        if (!authExitStartedRef.current) {
          authExitStartedRef.current = true;
          await endAuthenticatedSession();
          router.replace("/(auth)/login");
        }
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  }, [circleId, postId, queryClient, router]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete post?",
      "This will permanently remove your post and its comments.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void onDelete() },
      ]
    );
  }, [onDelete]);

  const toggleSave = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      if (saved) {
        await api.unsaveItem(token, "post", postId);
        setSavedPostId(queryClient, postId, false);
      } else {
        await api.saveItem(token, { itemType: "post", itemId: postId });
        setSavedPostId(queryClient, postId, true);
      }
    } catch (cause) {
      if (isUnauthorized(cause)) {
        if (!authExitStartedRef.current) {
          authExitStartedRef.current = true;
          await endAuthenticatedSession();
          router.replace("/(auth)/login");
        }
        return;
      }
      setError(
        cause instanceof Error ? cause.message : "Could not update save"
      );
    }
  }, [postId, queryClient, router, saved]);

  async function toggleHelpful() {
    const token = await getToken();
    if (!token || !post) return;
    try {
      const result = await api.togglePostHelpful(token, postId);
      mergeCirclePostFields(queryClient, circleId, postId, shareId, {
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
    if (queryClient.getQueryData<AuthUser>(["sessionUser"])?.suspended) {
      setError("This profile is suspended");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Your session expired. Please sign in again.");
        return;
      }
      const comment = await api.addReply(token, circleId, postId, text);
      appendThreadReply(queryClient, circleId, postId, shareId, comment);
      setCommentText("");
    } catch (cause) {
      if (isUnauthorized(cause)) {
        if (!authExitStartedRef.current) {
          authExitStartedRef.current = true;
          await endAuthenticatedSession();
          router.replace("/(auth)/login");
        }
        return;
      }
      setError(
        cause instanceof Error ? cause.message : "Failed to comment"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onSharePost() {
    if (!post) return;
    const token = await getToken();
    if (!token) return;
    const hasMedia = (post.media?.length ?? 0) > 0;
    Alert.alert("Share post", "Choose how you want to share.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Share post",
        onPress: () => {
          sharePostLink({
            token,
            circleId,
            postId,
            post,
          }).catch(() => {});
        },
      },
      ...(hasMedia
        ? [
            {
              text: "Share media",
              onPress: () => {
                sharePostMedia({
                  token,
                  circleId,
                  postId,
                  post,
                }).catch(() => {});
              },
            },
          ]
        : []),
    ]);
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
      if (poll) mergeThreadPoll(queryClient, circleId, postId, shareId, poll);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not vote");
    }
  }

  const isOwnPost =
    Boolean(currentUserId) &&
    Boolean(post) &&
    (post?.authorId === currentUserId || post?.author.userId === currentUserId);
  const canEdit =
    authoritative && isOwnPost && (capabilities?.canEdit ?? !readOnly);
  const canDelete =
    authoritative && isOwnPost && (capabilities?.canDelete ?? true);
  const canReply =
    authoritative &&
    (capabilities?.canReply ?? !readOnly) &&
    queryClient.getQueryData<AuthUser>(["sessionUser"])?.suspended !== true;
  const canViewReplies =
    authoritative && (capabilities?.canViewReplies ?? !readOnly);
  const suspended =
    queryClient.getQueryData<AuthUser>(["sessionUser"])?.suspended === true;
  const canVote = authoritative && (capabilities?.canVote ?? !readOnly);
  const isPreview = authoritative && readOnly;
  const seededDiscovery = Boolean(
    post && "discovery" in post && (post as { discovery?: boolean }).discovery
  );
  const canMarkHelpful =
    !isPreview &&
    (authoritative
      ? Boolean(capabilities?.canMarkHelpful) || isOwnPost
      : !seededDiscovery);
  const showHelpful = !isPreview;
  const canSave =
    savedQuery.isSuccess &&
    capabilities?.canSave !== false &&
    !isPreview;
  const showSave = !isPreview && capabilities?.canSave !== false;
  const canMessageAuthor =
    authoritative &&
    (capabilities?.canMessageAuthor ?? (!readOnly && !isOwnPost)) &&
    !isOwnPost &&
    Boolean(post?.authorId ?? post?.author.userId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Post",
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(app)" as never);
            }
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerBack}
        >
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          {canEdit ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/circles/[circleId]/new-post",
                  params: { circleId, postId },
                })
              }
              hitSlop={8}
              style={styles.headerEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit post"
            >
              <Ionicons name="pencil-outline" size={22} color={theme.text} />
            </Pressable>
          ) : null}
          {canDelete ? (
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
          ) : post && authoritative && !isOwnPost ? (
            <Pressable
              onPress={showPostSafetyActions}
              hitSlop={8}
              style={styles.headerMore}
              accessibilityRole="button"
              accessibilityLabel="Post safety options"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={theme.text}
              />
            </Pressable>
          ) : null}
        </View>
      ),
    });
  }, [
    navigation,
    canEdit,
    canDelete,
    isOwnPost,
    authoritative,
    post,
    deleting,
    circleId,
    postId,
    router,
    showPostSafetyActions,
    confirmDelete,
  ]);

  if (!post) {
    if (threadQuery.isLoading || threadQuery.isPending) {
      return <ScreenLoader />;
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>
          {threadQuery.error instanceof Error
            ? threadQuery.error.message
            : "Post not found"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void threadQuery.refetch()}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const helpfulCount = post.helpfulCount ?? 0;
  const commentCount = Math.max(post.replyCount ?? 0, comments.length);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={Platform.OS === "ios" ? ["bottom"] : []}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
      <FlatList
        style={styles.list}
        data={authoritative ? comments : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={[styles.postCard, cardShadow()]}>
              <View style={styles.postAccent} />
              <View style={styles.postInner}>
                {authoritative && readOnly ? (
                  <Text style={styles.discoveryBanner}>
                    {canViewReplies
                      ? "You can read this conversation. You’re not part of this circle."
                      : "You’re not part of this circle."}
                  </Text>
                ) : authoritative && capabilities && !capabilities.canOpenCircle ? (
                  <Text style={styles.discoveryBanner}>
                    You can follow replies here. You are not a member of this
                    circle.
                  </Text>
                ) : null}
                <AuthorRow
                  handle={post.author.anonymousHandle}
                  avatarKey={post.author.avatarKey}
                  contextLabel={post.author.contextLabel}
                  timestamp={post.createdAt}
                  editedAt={post.editedAt}
                  isGuest={post.author.isGuest}
                />
                <View style={styles.postContent}>
                  <PostTagBadge tag={post.tag} />
                  {post.body ? (
                    <Text style={styles.postBody} testID="clarity-mask">
                      {post.body}
                    </Text>
                  ) : null}
                </View>
                {post.poll && canVote ? (
                  <PollCard poll={post.poll} onVote={onPollVote} />
                ) : post.poll ? (
                  <PollCard poll={post.poll} />
                ) : null}
                <PostMediaGallery media={post.media ?? []} />
                <PostDocumentList documents={post.documents} />
                <PostContextChips
                  circles={post.circles}
                  topics={post.topics}
                  excludeCircleId={circleId}
                />

                {helpfulCount > 0 ? (
                  <Text style={styles.engagement}>
                    {helpfulCount} parent{helpfulCount === 1 ? "" : "s"} found
                    this helpful
                    {commentCount > 0
                      ? ` · ${commentCount} comment${commentCount === 1 ? "" : "s"}`
                      : ""}
                  </Text>
                ) : commentCount > 0 ? (
                  <Text style={styles.engagement}>
                    {commentCount} comment{commentCount === 1 ? "" : "s"}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  {showHelpful ? (
                    <Pressable
                      style={styles.helpfulAction}
                      onPress={toggleHelpful}
                      hitSlop={8}
                      disabled={!canMarkHelpful}
                      accessibilityRole="button"
                      accessibilityLabel="Mark as helpful"
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
                  ) : (
                    <View style={styles.helpfulAction} />
                  )}
                  <View style={styles.iconActions}>
                    <View
                      style={styles.iconAction}
                      accessibilityRole="text"
                      accessibilityLabel={
                        commentCount > 0
                          ? `${commentCount} comments`
                          : "No comments yet"
                      }
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={20}
                        color={theme.textMuted}
                      />
                      <Text style={styles.iconCount}>{commentCount}</Text>
                    </View>
                    <Pressable
                      style={styles.iconAction}
                      onPress={onSharePost}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Share"
                    >
                      <Ionicons
                        name="share-outline"
                        size={20}
                        color={theme.textMuted}
                      />
                    </Pressable>
                    {showSave ? (
                      <Pressable
                        style={styles.iconAction}
                        onPress={toggleSave}
                        hitSlop={8}
                        disabled={!canSave}
                        accessibilityRole="button"
                        accessibilityLabel={saved ? "Unsave post" : "Save post"}
                      >
                        <Ionicons
                          name={saved ? "bookmark" : "bookmark-outline"}
                          size={20}
                          color={saved ? theme.primary : theme.textMuted}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {canMessageAuthor ? (
                  <Pressable
                    style={styles.messageAuthor}
                    onPress={onMessageAuthor}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color={theme.textMuted}
                    />
                    <Text style={styles.actionText}>Message author</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>
                Comments ({commentCount})
              </Text>
              {!authoritative ? (
                <Text style={styles.commentsHint}>Loading comments</Text>
              ) : comments.length === 0 ? (
                <Text style={styles.commentsHint}>
                  {readOnly && !canViewReplies
                    ? "Join this circle to see comments and join the conversation."
                    : readOnly
                      ? "No comments yet"
                      : "Be the first to respond to this post"}
                </Text>
              ) : null}
              {threadQuery.isError && !authoritative ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void threadQuery.refetch()}
                  style={styles.inlineRetry}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item }) => <CommentCard comment={item} />}
        ListEmptyComponent={
          authoritative ? (
            <View style={styles.noComments}>
              <Ionicons
                name="chatbubble-outline"
                size={28}
                color={theme.textMuted}
              />
              <Text style={styles.noCommentsText}>No comments yet</Text>
            </View>
          ) : null
        }
      />

      {error && !submitting ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {suspended ? (
        <View
          style={[
            styles.composerBanner,
            cardShadow(),
            androidDockOffset > 0
              ? { marginBottom: androidDockOffset }
              : null,
          ]}
        >
          <Text style={styles.readOnlyNote}>This profile is suspended</Text>
        </View>
      ) : canReply ? (
      <View
        style={[
          styles.composerWrap,
          cardShadow(),
          androidDockOffset > 0
            ? { marginBottom: androidDockOffset }
            : null,
        ]}
      >
        {submitting ? (
          <Text style={styles.validatingHint}>
            Checking community guidelines…
          </Text>
        ) : null}
        <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Write a helpful comment…"
          placeholderTextColor={theme.textMuted}
          value={commentText}
          onChangeText={(value) => {
            if (error) setError(null);
            setCommentText(value);
          }}
          multiline
          maxLength={2000}
          editable={!submitting}
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!commentText.trim() || submitting) && styles.sendBtnDisabled,
          ]}
          onPress={onComment}
          disabled={submitting || !commentText.trim()}
          accessibilityRole="button"
          accessibilityLabel={
            submitting ? "Checking community guidelines" : "Post comment"
          }
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
        </View>
      </View>
      ) : authoritative ? (
        <View
          style={[
            styles.composerBanner,
            cardShadow(),
            androidDockOffset > 0
              ? { marginBottom: androidDockOffset }
              : null,
          ]}
        >
          <Text style={styles.readOnlyNote}>
            {canViewReplies
              ? "You can read this conversation. You can’t reply."
              : "You’re not part of this circle. You can view this shared post, but you cannot comment or open the rest of the circle."}
          </Text>
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerBack: { marginLeft: 4, paddingRight: 4 },
  headerEdit: { marginRight: 4 },
  headerDelete: { marginRight: 4 },
  headerMore: { marginRight: 8 },
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg },
  list: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
    gap: 12,
    padding: 24,
  },
  notFound: { color: theme.textMuted, fontSize: 15, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  retryText: { color: theme.primary, fontSize: 14, fontWeight: "700" },
  inlineRetry: { marginTop: 8 },
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
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  helpfulAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingRight: 8,
  },
  iconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconAction: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconCount: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
  },
  messageAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    minHeight: 36,
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
  discoveryBanner: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 10,
  },
  readOnlyNote: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.textMuted,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  composerWrap: {
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 8,
  },
  validatingHint: {
    color: theme.textMuted,
    fontSize: 13,
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 2,
    paddingBottom: 10,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: theme.card,
  },
  composerBanner: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
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
