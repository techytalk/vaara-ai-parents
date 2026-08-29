import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import {
  POST_TAGS,
  theme,
  type PostTagValue,
} from "@/components/circles/ui";
import {
  AudienceSheet,
  audienceSummary,
  TopicsSheet,
} from "@/components/circles/PostComposerPickers";
import { api, type Circle } from "@/lib/api";
import { getToken } from "@/lib/session";

type PendingMedia = {
  uri: string;
  fileName: string;
  mediaType: "image" | "video";
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

const TAG_ORDER: PostTagValue[] = [
  "general",
  "question",
  "recommendation",
  "heads_up",
];

const ORDERED_TAGS = TAG_ORDER.map(
  (value) => POST_TAGS.find((t) => t.value === value)!
);

const PLACEHOLDERS: Record<PostTagValue, string> = {
  general: "What's on your mind?",
  question: "What would you like to ask other parents?",
  recommendation: "Share what worked for you and why…",
  heads_up: "What should other parents know about?",
};

export default function NewPostScreen() {
  const { circleId, title, compose, tag: tagParam } = useLocalSearchParams<{
    circleId: string;
    title?: string;
    compose?: string;
    tag?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<PostTagValue>(() => {
    if (tagParam === "recommendation" || tagParam === "question" || tagParam === "heads_up" || tagParam === "general") {
      return tagParam;
    }
    if (compose === "recommendation") return "recommendation";
    if (compose === "question") return "question";
    return "general";
  });
  const [circles, setCircles] = useState<Circle[]>([]);
  const [additionalCircleIds, setAdditionalCircleIds] = useState<string[]>([]);
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [pollEnabled, setPollEnabled] = useState(compose === "poll");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [mediaEnabled, setMediaEnabled] = useState<boolean | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicOptions, setTopicOptions] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>([]);
  const [composeHandled, setComposeHandled] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [circleList, mediaStatus, catalog] = await Promise.all([
          api.getCircles(token),
          api.getMediaStatus(token).catch(() => ({ configured: false })),
          api.getTopicsCatalog(token).catch(() => ({ categories: {} })),
        ]);
        setCircles(circleList);
        setMediaEnabled(mediaStatus.configured);
        const flat = Object.values(catalog.categories).flat();
        setTopicOptions(flat.map((t) => ({ slug: t.slug, name: t.name })));
      } catch {
        setError("Could not load your circles");
      }
    });
  }, []);

  async function pickMedia() {
    if (!mediaEnabled) {
      setError("Image and video uploads require S3 configuration");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to add images or videos");
      return;
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

    const selected = result.assets
      .filter((asset) => asset.type === "image" || asset.type === "video")
      .map<PendingMedia>((asset, index) => {
        const mediaType = asset.type === "video" ? "video" : "image";
        return {
          uri: asset.uri,
          fileName:
            asset.fileName ??
            `${mediaType}-${Date.now()}-${index}.${mediaType === "video" ? "mp4" : "jpg"}`,
          mediaType,
          mimeType:
            asset.mimeType ??
            (mediaType === "video" ? "video/mp4" : "image/jpeg"),
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          durationMs: asset.duration ?? undefined,
        };
      });
    setMedia((current) => [...current, ...selected].slice(0, 4));
    setError(null);
  }

  useEffect(() => {
    if (compose !== "photo" || composeHandled || mediaEnabled !== true) return;
    setComposeHandled(true);
    void pickMedia();
  }, [compose, composeHandled, mediaEnabled]);

  async function uploadMedia(token: string) {
    const uploaded: Array<{
      storageKey: string;
      mediaType: "image" | "video";
      mimeType: string;
      width?: number;
      height?: number;
      durationMs?: number;
    }> = [];
    for (const [index, item] of media.entries()) {
      setUploadProgress(`Uploading ${index + 1} of ${media.length}…`);
      const fileInfo = await FileSystem.getInfoAsync(item.uri, { size: true });
      if (!fileInfo.exists) throw new Error(`Could not read ${item.fileName}`);
      const sizeBytes = fileInfo.size ?? item.fileSize ?? 0;
      if (!sizeBytes) {
        throw new Error(`Could not read file size for ${item.fileName}`);
      }
      const upload = await api.createMediaUpload(token, {
        fileName: item.fileName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        sizeBytes,
      });
      const uploadResponse = await FileSystem.uploadAsync(
        upload.uploadUrl,
        item.uri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": item.mimeType },
        }
      );
      if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
        const detail = uploadResponse.body?.slice(0, 200);
        throw new Error(
          `Could not upload ${item.fileName} (HTTP ${uploadResponse.status}${detail ? `: ${detail}` : ""})`
        );
      }
      uploaded.push({
        storageKey: upload.storageKey,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        durationMs: item.durationMs,
      });
    }
    return uploaded;
  }

  async function onSubmit() {
    const text = body.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!text && media.length === 0 && !pollEnabled) {
      setError("Write something, add a poll, or add a photo or video");
      return;
    }
    if (pollEnabled) {
      if (!pollQuestion.trim()) {
        setError("Enter a poll question");
        return;
      }
      if (options.length < 2) {
        setError("Polls need at least 2 options");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const uploadedMedia = await uploadMedia(token);
      setUploadProgress("Publishing post…");
      await api.createPost(token, circleId, {
        body: text,
        tag,
        targetCircleIds: additionalCircleIds,
        media: uploadedMedia,
        poll: pollEnabled
          ? {
              question: pollQuestion.trim(),
              options,
            }
          : undefined,
        topicSlugs:
          selectedTopicSlugs.length > 0 ? selectedTopicSlugs : undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setUploadProgress(null);
      setLoading(false);
    }
  }

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const canPost =
    body.trim().length > 0 || media.length > 0 || pollEnabled;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publish post"
          accessibilityState={{ disabled: !canPost || loading }}
          hitSlop={8}
          style={[styles.postBtn, (!canPost || loading) && styles.postBtnOff]}
          onPress={() => void submitRef.current()}
          disabled={!canPost || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </Pressable>
      ),
    });
  }, [navigation, canPost, loading]);

  const primaryCircle = circles.find((circle) => circle.id === circleId);
  const audienceLabel = audienceSummary({
    primaryCircle,
    primaryLabel: title ?? "This circle",
    selectedIds: additionalCircleIds,
  });
  const selectedTopics = topicOptions.filter((topic) =>
    selectedTopicSlugs.includes(topic.slug)
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={styles.metaBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Share with ${audienceLabel}. Change circles`}
          style={styles.audiencePill}
          onPress={() => setAudienceOpen(true)}
        >
          <Ionicons name="people" size={14} color={theme.primaryDark} />
          <Text style={styles.audienceText} numberOfLines={1}>
            {audienceLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.primaryDark} />
        </Pressable>
        <View style={styles.anonPill}>
          <Ionicons name="eye-off" size={13} color={theme.textMuted} />
          <Text style={styles.anonText}>Anonymous</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeStrip}
        contentContainerStyle={styles.typeStripContent}
      >
        {ORDERED_TAGS.map((t) => {
          const active = tag === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                styles.typeChip,
                active && { backgroundColor: t.bg, borderColor: t.color },
              ]}
              onPress={() => setTag(t.value)}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={active ? t.color : theme.textMuted}
              />
              <Text
                style={[styles.typeChipText, active && { color: t.color }]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <TextInput
          style={styles.input}
          placeholder={PLACEHOLDERS[tag]}
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
          autoFocus
          value={body}
          onChangeText={setBody}
        />

        {media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaStrip}
          >
            {media.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.mediaThumb}>
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

        {pollEnabled ? (
          <View style={styles.pollPanel}>
            <View style={styles.pollHeader}>
              <Ionicons
                name="stats-chart"
                size={15}
                color={theme.primaryDark}
              />
              <Text style={styles.pollHeaderText}>Poll</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove poll"
                hitSlop={8}
                onPress={() => setPollEnabled(false)}
              >
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            </View>
            <TextInput
              style={styles.pollInput}
              placeholder="Poll question"
              placeholderTextColor={theme.textMuted}
              value={pollQuestion}
              onChangeText={setPollQuestion}
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
              />
            ))}
            {pollOptions.length < 6 ? (
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
      </ScrollView>

      {selectedTopics.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topicStrip}
          contentContainerStyle={styles.topicStripContent}
        >
          {selectedTopics.map((topic) => (
            <Pressable
              key={topic.slug}
              accessibilityRole="button"
              accessibilityLabel={`Remove topic ${topic.name}`}
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
        </ScrollView>
      ) : null}

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
          styles.toolbar,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
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
          label="Add a poll"
          active={pollEnabled}
          onPress={() => setPollEnabled((current) => !current)}
        />
        <ToolbarButton
          icon="pricetag-outline"
          label="Add topics"
          count={selectedTopicSlugs.length}
          active={selectedTopicSlugs.length > 0}
          disabled={topicOptions.length === 0}
          onPress={() => setTopicsOpen(true)}
        />
        <View style={styles.toolbarSpacer} />
        <Text style={styles.charCount}>{body.length}</Text>
      </View>

      <AudienceSheet
        visible={audienceOpen}
        onClose={() => setAudienceOpen(false)}
        primaryCircle={primaryCircle}
        primaryLabel={title ?? "This circle"}
        circles={circles}
        selectedIds={additionalCircleIds}
        onChange={setAdditionalCircleIds}
      />
      <TopicsSheet
        visible={topicsOpen}
        onClose={() => setTopicsOpen(false)}
        topics={topicOptions}
        selectedSlugs={selectedTopicSlugs}
        onChange={setSelectedTopicSlugs}
      />
    </KeyboardAvoidingView>
  );
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
  container: { flex: 1, backgroundColor: theme.bg },

  postBtn: {
    minWidth: 62,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  postBtnOff: { backgroundColor: theme.primaryLight },
  postBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  audiencePill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.primaryLight,
  },
  audienceText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.primaryDark,
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

  typeStrip: { flexGrow: 0, marginTop: 10 },
  typeStripContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  typeChipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },

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

  topicStrip: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  topicStripContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
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

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.card,
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
});
