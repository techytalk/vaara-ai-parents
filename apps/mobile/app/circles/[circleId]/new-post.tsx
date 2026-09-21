import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomChromeInset } from "@/hooks/useBottomChromeInset";
import { useAndroidImeDockOffset } from "@/hooks/useKeyboardHeight";
import * as ImagePicker from "expo-image-picker";
import {
  POST_TAGS,
  ScreenLoader,
  theme,
  type PostTagValue,
} from "@/components/circles/ui";
import {
  AudienceSheet,
  audienceSummary,
  PostTypeSheet,
  TopicsSheet,
} from "@/components/circles/PostComposerPickers";
import { api, type AuthUser, type CirclePost, type GuestQuota } from "@/lib/api";
import {
  authed,
  endAuthenticatedSession,
  isUnauthorized,
} from "@/lib/authenticated-state";
import {
  findCachedCirclePost,
  mapWithConcurrency,
  mergePostIntoMyPosts,
  postThreadQueryKey,
  upsertPostInFeeds,
  type PostThreadData,
} from "@/lib/post-cache";
import {
  persistPickedMediaUri,
  resolveMediaBytes,
  uploadMediaBytes,
} from "@/lib/media-local";
import {
  cleanDocumentsForCreate,
  cleanDocumentsForPayload,
  documentsBusy,
  MAX_POST_DOCUMENTS,
  pickDocuments,
  type PendingDocument,
  uploadAndScanDocument,
} from "@/lib/document-upload";
import { getStoredUser } from "@/lib/session";
import { LEGAL_URLS } from "@/constants/legal";

type PendingMedia = {
  id?: string;
  uri: string;
  fileName: string;
  mediaType: "image" | "video";
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

function editorStateFromPost(post: CirclePost) {
  const nextTag: PostTagValue =
    post.tag === "recommendation" ||
    post.tag === "question" ||
    post.tag === "heads_up" ||
    post.tag === "general"
      ? post.tag
      : "general";
  return {
    body: post.body ?? "",
    tag: nextTag,
    selectedTopicSlugs: post.topics?.map((topic) => topic.slug) ?? [],
    media: (post.media ?? []).map((item, index) => ({
      id: item.id,
      uri: item.url,
      fileName: `${item.type}-${index + 1}`,
      mediaType: item.type,
      mimeType: item.mimeType,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      durationMs: item.durationMs ?? undefined,
    })),
    documents: (post.documents ?? []).map((item) => ({
      localId: item.id,
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: "clean" as const,
    })),
    pollEnabled: Boolean(post.poll),
    pollQuestion: post.poll?.question ?? "",
    pollOptions: post.poll?.options.map((option) => option.label) ?? ["", ""],
    pollLocked: Boolean(post.poll && post.poll.totalVotes > 0),
  };
}

const PLACEHOLDERS: Record<PostTagValue, string> = {
  general: "What's on your mind?",
  question: "What would you like to ask other parents?",
  recommendation: "Share what worked for you and why…",
  heads_up: "What should other parents know about?",
};

export default function NewPostScreen() {
  const { circleId, title, compose, tag: tagParam, postId, body: bodyParam } =
    useLocalSearchParams<{
      circleId: string;
      title?: string;
      compose?: string;
      tag?: string;
      postId?: string;
      body?: string;
    }>();
  const isEditing = Boolean(postId);
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const bottomChrome = useBottomChromeInset();
  const androidDockOffset = useAndroidImeDockOffset(bottomChrome);
  const bodyInputRef = useRef<TextInput>(null);
  const didFocusBody = useRef(false);
  const authExitStartedRef = useRef(false);
  const [seededPost] = useState(() =>
    isEditing && circleId && postId
      ? findCachedCirclePost(queryClient, circleId, postId)
      : undefined
  );
  const seededEditor = seededPost ? editorStateFromPost(seededPost) : null;
  const [body, setBody] = useState(() => {
    if (seededEditor?.body) return seededEditor.body;
    if (typeof bodyParam === "string" && bodyParam.trim()) return bodyParam;
    return "";
  });
  const [tag, setTag] = useState<PostTagValue>(() => {
    if (seededEditor) return seededEditor.tag;
    if (tagParam === "recommendation" || tagParam === "question" || tagParam === "heads_up" || tagParam === "general") {
      return tagParam;
    }
    if (compose === "recommendation") return "recommendation";
    if (compose === "question") return "question";
    return "general";
  });
  const [additionalCircleIds, setAdditionalCircleIds] = useState<string[]>([]);
  const [media, setMedia] = useState<PendingMedia[]>(() => seededEditor?.media ?? []);
  const [documents, setDocuments] = useState<PendingDocument[]>(
    () => seededEditor?.documents ?? []
  );
  const [pollEnabled, setPollEnabled] = useState(
    () => seededEditor?.pollEnabled ?? compose === "poll"
  );
  const [pollQuestion, setPollQuestion] = useState(
    () => seededEditor?.pollQuestion ?? ""
  );
  const [pollOptions, setPollOptions] = useState(
    () => seededEditor?.pollOptions ?? ["", ""]
  );
  const [pollLocked, setPollLocked] = useState(
    () => seededEditor?.pollLocked ?? false
  );
  const [editReady, setEditReady] = useState(!isEditing || Boolean(seededEditor));
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>(
    () => seededEditor?.selectedTopicSlugs ?? []
  );
  const [composeHandled, setComposeHandled] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [guestQuota, setGuestQuota] = useState<GuestQuota | null>(null);
  const [postLoadError, setPostLoadError] = useState<unknown>(null);

  const circlesQuery = useQuery({
    queryKey: ["circles"],
    queryFn: () => authed((token) => api.getCircles(token)),
    retry: false,
  });
  const topicsQuery = useQuery({
    queryKey: ["topicsCatalog"],
    queryFn: () => authed((token) => api.getTopicsCatalog(token)),
    retry: false,
  });
  const mediaStatusQuery = useQuery({
    queryKey: ["mediaStatus"],
    queryFn: () => authed((token) => api.getMediaStatus(token)),
    retry: false,
  });

  const circles = circlesQuery.data ?? [];
  const mediaEnabled = mediaStatusQuery.data?.configured ?? null;
  const topicOptions = Object.values(topicsQuery.data?.categories ?? {})
    .flat()
    .map((topic) => ({ slug: topic.slug, name: topic.name }));
  const audienceReady = isEditing || circlesQuery.isSuccess;

  function showSubmitError(message: string) {
    setError(message);
    Alert.alert(isEditing ? "Could not save" : "Could not post", message);
  }

  function startAuthExit() {
    if (authExitStartedRef.current) return;
    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }

  useEffect(() => {
    const unauthorized = [
      circlesQuery.error,
      topicsQuery.error,
      mediaStatusQuery.error,
      postLoadError,
    ].some(isUnauthorized);
    if (!unauthorized) return;
    startAuthExit();
  }, [
    circlesQuery.error,
    mediaStatusQuery.error,
    postLoadError,
    router,
    topicsQuery.error,
  ]);

  useEffect(() => {
    if (isEditing || didFocusBody.current) return;
    didFocusBody.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      bodyInputRef.current?.focus();
    });
    return () => task.cancel();
  }, [isEditing]);

  function applyEditorState(next: ReturnType<typeof editorStateFromPost>) {
    setBody(next.body);
    setTag(next.tag);
    setSelectedTopicSlugs(next.selectedTopicSlugs);
    setMedia(next.media);
    setDocuments(next.documents);
    setPollEnabled(next.pollEnabled);
    setPollQuestion(next.pollQuestion);
    setPollOptions(next.pollOptions);
    setPollLocked(next.pollLocked);
  }

  async function assertCanEdit(post: CirclePost) {
    const user =
      queryClient.getQueryData<AuthUser>(["sessionUser"]) ??
      (await getStoredUser());
    const authorId = post.authorId ?? post.author.userId;
    if (!user?.id || authorId !== user.id) {
      Alert.alert("Can’t edit", "You can only edit your own posts.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (!isEditing || !seededPost) return;
    void assertCanEdit(seededPost);
  }, [isEditing, seededPost]);

  useEffect(() => {
    if (!isEditing || !postId || !circleId || seededPost) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await authed((token) =>
          api.getPost(token, circleId, postId)
        );
        if (cancelled) return;
        if (!(await assertCanEdit(data.post))) return;
        queryClient.setQueryData<PostThreadData>(
          postThreadQueryKey(circleId, postId),
          {
            post: data.post,
            replies: data.replies,
            readOnly: Boolean(data.readOnly ?? data.post.readOnly),
            capabilities: data.capabilities ?? null,
            authoritative: true,
          }
        );
        applyEditorState(editorStateFromPost(data.post));
        setEditReady(true);
      } catch (cause) {
        if (cancelled) return;
        if (isUnauthorized(cause)) {
          setPostLoadError(cause);
          return;
        }
        setError(
          cause instanceof Error ? cause.message : "Could not load this post"
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId, isEditing, postId, seededPost]);

  async function pickMedia() {
    if (!mediaEnabled) {
      setError("Image and video uploads require S3 configuration");
      return;
    }
    // Android 13+: system photo picker — do not request READ_MEDIA_* (Play policy).
    if (Platform.OS === "ios") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photos permission is required to attach media.");
        return;
      }
    }

    const remaining = 4 - media.length;
    if (remaining <= 0) {
      setError("A post can include up to 4 attachments");
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

    const selected: PendingMedia[] = [];
    for (const [index, asset] of result.assets.entries()) {
      if (asset.type !== "image" && asset.type !== "video") continue;
      const mediaType = asset.type === "video" ? "video" : "image";
      const fileName =
        asset.fileName ??
        `${mediaType}-${Date.now()}-${index}.${mediaType === "video" ? "mp4" : "jpg"}`;
      // Persist while gallery URI grant is valid — DocumentPicker revokes it.
      const uri = await persistPickedMediaUri(asset.uri, fileName);
      selected.push({
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
      });
    }
    setMedia((current) => [...current, ...selected].slice(0, 4));
    setError(null);
  }


  async function pickDocs() {
    if (!mediaEnabled) {
      setError("Document uploads require media storage to be configured");
      return;
    }
    const remaining = MAX_POST_DOCUMENTS - documents.length;
    if (remaining <= 0) {
      setError(`A post can include up to ${MAX_POST_DOCUMENTS} documents`);
      return;
    }
    // DocumentPicker can revoke temporary gallery URI grants — persist first.
    if (media.length > 0) {
      const persisted = await Promise.all(
        media.map(async (item) => {
          if (item.id) return item;
          const uri = await persistPickedMediaUri(item.uri, item.fileName);
          return uri === item.uri ? item : { ...item, uri };
        })
      );
      setMedia(persisted);
    }
    const picked = await pickDocuments(remaining);
    if (picked.length === 0) return;
    setDocuments((current) => [...current, ...picked].slice(0, MAX_POST_DOCUMENTS));
    setError(null);
    try {
      await authed(async (token) => {
        for (const doc of picked) {
          if (doc.status !== "uploading") continue;
          await uploadAndScanDocument(token, doc, (next) => {
            setDocuments((current) =>
              current.map((item) =>
                item.localId === next.localId ? next : item
              )
            );
          });
        }
      });
    } catch (cause) {
      if (isUnauthorized(cause)) {
        startAuthExit();
        return;
      }
      setError(
        cause instanceof Error ? cause.message : "Could not upload document"
      );
    }
  }

  useEffect(() => {
    if (isEditing || compose !== "photo" || composeHandled || mediaEnabled !== true) {
      return;
    }
    setComposeHandled(true);
    void pickMedia();
  }, [compose, composeHandled, isEditing, mediaEnabled]);

  async function uploadMediaItems(token: string, items: PendingMedia[]) {
    type MediaPayload = {
      id?: string;
      storageKey?: string;
      mediaType?: "image" | "video";
      mimeType?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    };
    const payload: MediaPayload[] = items.map((item) =>
      item.id ? { id: item.id } : {}
    );
    const pending = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.id);
    let completed = 0;
    if (pending.length > 0) {
      setUploadProgress(`Uploading 0 of ${pending.length}…`);
    }
    await mapWithConcurrency(pending, 2, async ({ item, index }) => {
      const { sizeBytes, body: bytes } = await resolveMediaBytes(
        item.uri,
        item.fileName,
        item.fileSize
      );
      const upload = await api.createMediaUpload(token, {
        fileName: item.fileName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        sizeBytes,
      });
      await uploadMediaBytes(
        upload.uploadUrl,
        bytes,
        item.mimeType,
        item.fileName
      );
      payload[index] = {
        storageKey: upload.storageKey,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        durationMs: item.durationMs,
      };
      completed += 1;
      setUploadProgress(`Uploading ${completed} of ${pending.length}…`);
    });
    return payload;
  }

  async function onSubmit() {
    const text = body.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    const hasContent =
      text.length > 0 || media.length > 0 || documents.some((d) => d.status === "clean") || pollEnabled;
    if (!hasContent) {
      showSubmitError("Write something, add a poll, photo, video, or document");
      return;
    }
    if (documentsBusy(documents)) {
      showSubmitError("Wait for document checks to finish before posting");
      return;
    }
    if (pollEnabled && !pollLocked) {
      if (!pollQuestion.trim()) {
        showSubmitError("Enter a poll question");
        return;
      }
      if (options.length < 2) {
        showSubmitError("Polls need at least 2 options");
        return;
      }
    }
    if (!circleId) {
      showSubmitError("This circle is missing. Go back and open New post again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authed(async (token) => {
        let circleList = circlesQuery.data;
        if (!circleList?.some((circle) => circle.id === circleId)) {
          try {
            circleList = await api.getCircles(token);
            queryClient.setQueryData(["circles"], circleList);
          } catch (cause) {
            if (isUnauthorized(cause)) throw cause;
            if (!isEditing) {
              showSubmitError(
                cause instanceof Error
                  ? cause.message
                  : "Could not load your circles"
              );
              return;
            }
          }
        }
        if (!isEditing) {
          const memberIds = new Set((circleList ?? []).map((circle) => circle.id));
          if (!memberIds.has(circleId)) {
            showSubmitError(
              "You are not in this circle. Open Circles, refresh, and try again."
            );
            return;
          }
        }
        if (isEditing && postId) {
          const mediaPayload = await uploadMediaItems(token, media);
          setUploadProgress("Saving post…");
          const updated = await api.updatePost(token, circleId, postId, {
            body: text,
            tag,
            media: mediaPayload,
            documents: cleanDocumentsForPayload(documents),
            poll:
              pollEnabled && !pollLocked
                ? {
                    question: pollQuestion.trim(),
                    options,
                  }
                : undefined,
            topicSlugs: selectedTopicSlugs,
          });
          const threadKey = postThreadQueryKey(circleId, postId);
          const hadThread = Boolean(
            queryClient.getQueryData<PostThreadData>(threadKey)
          );
          queryClient.setQueryData<PostThreadData | undefined>(
            threadKey,
            (current) =>
              current
                ? { ...current, post: { ...current.post, ...updated } }
                : current
          );
          upsertPostInFeeds(queryClient, updated, circleId);
          mergePostIntoMyPosts(queryClient, updated, circleId);
          void queryClient.invalidateQueries({ queryKey: ["topicFeed"] });
          router.back();
          if (!hadThread) {
            void queryClient.invalidateQueries({ queryKey: threadKey });
          }
          return;
        }
        const uploadedMedia = (await uploadMediaItems(token, media)).filter(
          (
            item
          ): item is {
            storageKey: string;
            mediaType: "image" | "video";
            mimeType: string;
            width?: number;
            height?: number;
            durationMs?: number;
          } => Boolean(item.storageKey && item.mediaType && item.mimeType)
        );
        setUploadProgress("Publishing post…");
        const targetCircleIds = [
          ...new Set([circleId, ...additionalCircleIds].filter(Boolean)),
        ];
        const result = await api.createCrossPosts(token, {
          body: text,
          tag,
          targetCircleIds,
          media: uploadedMedia,
          documents: cleanDocumentsForCreate(documents),
          poll: pollEnabled
            ? {
                question: pollQuestion.trim(),
                options,
              }
            : undefined,
          topicSlugs:
            selectedTopicSlugs.length > 0 ? selectedTopicSlugs : undefined,
        });
        if (result.guestQuota) {
          setGuestQuota(result.guestQuota);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["circleFeed"] }),
          queryClient.invalidateQueries({ queryKey: ["homeFeed"] }),
          queryClient.invalidateQueries({ queryKey: ["circles"] }),
          queryClient.invalidateQueries({ queryKey: ["myPosts"] }),
        ]);
        router.replace({
          pathname: "/circles/[circleId]/posts/[postId]",
          params: {
            circleId: result.primaryCircleId,
            postId: result.postId,
          },
        });
      });
    } catch (e) {
      if (isUnauthorized(e)) {
        startAuthExit();
        return;
      }
      showSubmitError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setUploadProgress(null);
      setLoading(false);
    }
  }

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const canPost =
    (body.trim().length > 0 ||
      media.length > 0 ||
      documents.some((d) => d.status === "clean") ||
      pollEnabled) &&
    !documentsBusy(documents);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit post" : "New post",
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
      headerRight: () => null,
    });
  }, [navigation, isEditing, router]);

  const primaryCircle = circles.find((circle) => circle.id === circleId);
  const audienceLabel = audienceSummary({
    primaryCircle,
    primaryLabel: title ?? "This circle",
    selectedIds: additionalCircleIds,
  });
  const selectedTopics = topicOptions.filter((topic) =>
    selectedTopicSlugs.includes(topic.slug)
  );
  const tagMeta = POST_TAGS.find((item) => item.value === tag) ?? POST_TAGS[3];

  if (isEditing && !editReady) {
    return error ? (
      <View style={styles.container}>
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={16} color={theme.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    ) : (
      <ScreenLoader />
    );
  }

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
      <View style={styles.metaBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isEditing
              ? `Posted to ${audienceLabel}. Circles can’t be changed`
              : `Post to ${audienceLabel}. Change circles`
          }
          style={[
            styles.audiencePill,
            !audienceReady && styles.audiencePillDisabled,
          ]}
          disabled={!audienceReady}
          onPress={() => setAudienceOpen(true)}
        >
          <Ionicons name="people" size={14} color={theme.primaryDark} />
          <Text style={styles.audienceText} numberOfLines={1}>
            {audienceLabel}
          </Text>
          <Ionicons
            name={isEditing ? "lock-closed" : "chevron-down"}
            size={14}
            color={theme.primaryDark}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Post type ${tagMeta.label}. Change type`}
          style={[
            styles.typePill,
            { backgroundColor: tagMeta.bg, borderColor: tagMeta.color },
          ]}
          onPress={() => setTypeOpen(true)}
        >
          <Ionicons name={tagMeta.icon} size={14} color={tagMeta.color} />
          <Text style={[styles.typePillText, { color: tagMeta.color }]} numberOfLines={1}>
            {tagMeta.label}
          </Text>
          <Ionicons name="chevron-down" size={14} color={tagMeta.color} />
        </Pressable>
        <View style={styles.anonPill}>
          <Ionicons name="eye-off" size={13} color={theme.textMuted} />
          <Text style={styles.anonText}>Anonymous</Text>
        </View>
      </View>
      {isEditing ? (
        <Text style={styles.audienceLockedHint}>
          Circles can’t be changed after posting.
        </Text>
      ) : null}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <TextInput
          ref={bodyInputRef}
          style={styles.input}
          placeholder={PLACEHOLDERS[tag]}
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
          autoFocus={false}
          value={body}
          onChangeText={setBody}
          testID="clarity-mask"
        />

        {media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaStrip}
          >
            {media.map((item, index) => (
              <View key={item.id ?? `${item.uri}-${index}`} style={styles.mediaThumb}>
                {item.mediaType === "image" ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.thumbImage}
                  />
                ) : (
                  <View style={styles.thumbVideo}>
                    <Ionicons name="play-circle" size={28} color="#fff" />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.fileName}`}
                  hitSlop={6}
                  style={styles.thumbRemove}
                  onPress={() =>
                    setMedia((current) =>
                      current.filter((_, mediaIndex) => mediaIndex !== index)
                    )
                  }
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {documents.length > 0 ? (
          <View style={styles.docList}>
            <Text style={styles.docPrivacyHint}>
              File names are visible to everyone in the circle.
            </Text>
            {documents.map((doc) => {
              const subtitle =
                doc.status === "uploading"
                  ? `${formatDocSize(doc.sizeBytes)} · Uploading…`
                  : doc.status === "scanning"
                    ? `${formatDocSize(doc.sizeBytes)} · Checking file…`
                    : doc.status === "clean"
                      ? `${docTypeLabel(doc.mimeType)} · ${formatDocSize(doc.sizeBytes)} · Ready`
                      : doc.status === "blocked"
                        ? doc.reason ??
                          "Blocked — this file failed the safety check and was not uploaded"
                        : doc.reason ??
                          "Could not check this file. Remove it and try again.";
              return (
                <View
                  key={doc.localId}
                  style={[
                    styles.docRow,
                    (doc.status === "blocked" || doc.status === "failed") &&
                      styles.docRowBad,
                  ]}
                >
                  <Ionicons
                    name={
                      doc.status === "blocked" || doc.status === "failed"
                        ? "warning-outline"
                        : "document-attach-outline"
                    }
                    size={18}
                    color={
                      doc.status === "blocked" || doc.status === "failed"
                        ? theme.error
                        : theme.primaryDark
                    }
                  />
                  <View style={styles.docMeta}>
                    <Text style={styles.docName} numberOfLines={1}>
                      {doc.fileName}
                    </Text>
                    <Text style={styles.docSub} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${doc.fileName}`}
                    hitSlop={6}
                    onPress={() =>
                      setDocuments((current) =>
                        current.filter((item) => item.localId !== doc.localId)
                      )
                    }
                  >
                    <Ionicons name="close" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {pollEnabled ? (
          <View style={styles.pollPanel}>
            <View style={styles.pollHeader}>
              <Ionicons
                name="stats-chart"
                size={15}
                color={theme.primaryDark}
              />
              <Text style={styles.pollHeaderText}>Poll</Text>
              {isEditing ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove poll"
                  hitSlop={8}
                  onPress={() => setPollEnabled(false)}
                >
                  <Ionicons name="close" size={18} color={theme.textMuted} />
                </Pressable>
              )}
            </View>
            {isEditing ? (
              <Text style={styles.pollHint}>
                {pollLocked
                  ? "This poll already has votes, so the question and options can’t be changed."
                  : "You can edit this poll until someone votes."}
              </Text>
            ) : null}
            <TextInput
              style={styles.pollInput}
              placeholder="Poll question"
              placeholderTextColor={theme.textMuted}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              editable={!pollLocked}
              testID="clarity-mask"
            />
            {pollOptions.map((option, index) => (
              <TextInput
                key={`poll-option-${index}`}
                style={styles.pollInput}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={theme.textMuted}
                value={option}
                onChangeText={(value) =>
                  setPollOptions((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? value : item
                    )
                  )
                }
                editable={!pollLocked}
                testID="clarity-mask"
              />
            ))}
            {!pollLocked && pollOptions.length < 6 ? (
              <Pressable
                accessibilityRole="button"
                style={styles.addPollOption}
                onPress={() =>
                  setPollOptions((current) =>
                    current.length < 6 ? [...current, ""] : current
                  )
                }
              >
                <Ionicons name="add" size={16} color={theme.primary} />
                <Text style={styles.addPollOptionText}>Add option</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {selectedTopics.length > 0 ? (
          <View style={styles.topicWrap}>
            {selectedTopics.map((topic) => (
              <Pressable
                key={topic.slug}
                accessibilityRole="button"
                accessibilityLabel={`Remove interest ${topic.name}`}
                style={styles.topicChip}
                onPress={() =>
                  setSelectedTopicSlugs((current) =>
                    current.filter((slug) => slug !== topic.slug)
                  )
                }
              >
                <Text style={styles.topicChipText}>{topic.name}</Text>
                <Ionicons name="close" size={13} color={theme.primaryDark} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={16} color={theme.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {uploadProgress ? (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.progressText}>{uploadProgress}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.composerDock,
          androidDockOffset > 0
            ? { marginBottom: androidDockOffset }
            : null,
        ]}
      >
        <View style={styles.toolbar}>
          <ToolbarButton
            icon="image-outline"
            label="Add photos or videos"
            count={media.length}
            active={media.length > 0}
            disabled={mediaEnabled !== true}
            onPress={pickMedia}
          />
          <ToolbarButton
            icon="stats-chart-outline"
            label={
              isEditing
                ? pollEnabled
                  ? "Poll on this post"
                  : "Polls can’t be added after posting"
                : "Add a poll"
            }
            active={pollEnabled}
            disabled={isEditing}
            onPress={() => {
              if (isEditing) return;
              setPollEnabled((current) => !current);
            }}
          />
          <ToolbarButton
            icon="attach-outline"
            label="Add a document"
            count={documents.length}
            active={documents.length > 0}
            disabled={mediaEnabled !== true}
            onPress={() => void pickDocs()}
          />
          <ToolbarButton
            icon="pricetag-outline"
            label="Add interests"
            count={selectedTopicSlugs.length}
            active={selectedTopicSlugs.length > 0}
            disabled={!topicsQuery.isSuccess}
            onPress={() => setTopicsOpen(true)}
          />
          <View style={styles.toolbarSpacer} />
          <Text style={styles.charCount}>{body.length}</Text>
        </View>
        <Text
          accessibilityRole="link"
          style={styles.guidelinesHint}
          onPress={() => {
            Linking.openURL(LEGAL_URLS.communityGuidelines).catch(() => {});
          }}
        >
          Posts must follow our Community Guidelines. You can report or block from the ⋯ menu on any post or chat.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Save post" : "Publish post"}
          accessibilityState={{ disabled: !canPost || loading || !editReady }}
          style={[
            styles.submitBtn,
            (!canPost || loading || !editReady) && styles.submitBtnOff,
          ]}
          onPress={() => void submitRef.current()}
          disabled={loading || !editReady || !canPost}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isEditing ? "Save" : "Post"}
            </Text>
          )}
        </Pressable>
      </View>

      <AudienceSheet
        visible={audienceOpen}
        onClose={() => setAudienceOpen(false)}
        primaryCircle={primaryCircle}
        primaryLabel={title ?? "This circle"}
        circles={circles}
        selectedIds={additionalCircleIds}
        onChange={setAdditionalCircleIds}
        locked={isEditing}
        guestQuota={guestQuota}
        onGuestQuotaChange={setGuestQuota}
      />
      <PostTypeSheet
        visible={typeOpen}
        onClose={() => setTypeOpen(false)}
        value={tag}
        onChange={setTag}
      />
      <TopicsSheet
        visible={topicsOpen}
        onClose={() => setTopicsOpen(false)}
        topics={topicOptions}
        selectedSlugs={selectedTopicSlugs}
        onChange={setSelectedTopicSlugs}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDocSize(sizeBytes: number): string {
  if (!sizeBytes) return "0 B";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "Word";
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Excel";
  }
  return "File";
}

function ToolbarButton({
  icon,
  label,
  count,
  active,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = disabled
    ? theme.tabInactive
    : active
      ? theme.primary
      : theme.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: active }}
      style={styles.toolbarBtn}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={23} color={color} />
      {count ? (
        <View style={styles.toolbarBadge}>
          <Text style={styles.toolbarBadgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  headerBack: { marginLeft: 4, paddingRight: 4 },
  container: { flex: 1, backgroundColor: theme.bg },

  submitBtn: {
    marginHorizontal: 12,
    marginTop: 4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnOff: { backgroundColor: theme.primaryLight },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexWrap: "wrap",
  },
  audiencePill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    maxWidth: "48%",
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.primaryLight,
  },
  audiencePillDisabled: {
    opacity: 0.55,
  },
  audienceText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.primaryDark,
  },
  typePill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    borderWidth: 1,
  },
  typePillText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  anonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: theme.surfaceMuted,
  },
  anonText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
  audienceLockedHint: {
    paddingHorizontal: 16,
    paddingTop: 6,
    fontSize: 12,
    color: theme.textMuted,
  },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  input: {
    paddingTop: 14,
    minHeight: 140,
    fontSize: 17,
    color: theme.text,
    lineHeight: 25,
  },

  mediaStrip: { gap: 10, paddingVertical: 4 },
  docList: { gap: 8, marginTop: 12 },
  docPrivacyHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  docRowBad: {
    borderColor: theme.error,
    backgroundColor: theme.errorSoft,
  },
  docMeta: { flex: 1, minWidth: 0 },
  docName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  docSub: {
    marginTop: 2,
    fontSize: 12,
    color: theme.textMuted,
  },
  mediaThumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.surfaceMuted,
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbVideo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2933",
  },
  thumbRemove: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  pollPanel: {
    marginTop: 16,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
  },
  pollHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pollHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pollHint: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textMuted,
  },
  pollInput: {
    backgroundColor: theme.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.text,
  },
  addPollOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    minHeight: 34,
  },
  addPollOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },

  topicWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: theme.primarySoft,
  },
  topicChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primaryDark,
  },

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.errorSoft,
  },
  errorText: { flex: 1, fontSize: 13, color: theme.error, lineHeight: 18 },

  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.primarySoft,
  },
  progressText: { fontSize: 13, color: theme.primaryDark, fontWeight: "600" },

  composerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.card,
    paddingTop: 6,
    paddingBottom: 10,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  toolbarBtn: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarSpacer: { flex: 1 },
  toolbarBadge: {
    position: "absolute",
    top: 4,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
  },
  toolbarBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  charCount: {
    fontSize: 12,
    color: theme.textMuted,
    paddingRight: 6,
  },
  guidelinesHint: {
    fontSize: 11,
    lineHeight: 15,
    color: theme.textMuted,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
