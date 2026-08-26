import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import {
  cardShadow,
  POST_TAGS,
  PrimaryButton,
  theme,
  type PostTagValue,
} from "@/components/circles/ui";
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

export default function NewPostScreen() {
  const { circleId, title } = useLocalSearchParams<{
    circleId: string;
    title?: string;
  }>();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<PostTagValue>("general");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [additionalCircleIds, setAdditionalCircleIds] = useState<string[]>([]);
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
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

  function toggleTopic(slug: string) {
    setSelectedTopicSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((s) => s !== slug);
      }
      if (current.length >= 3) {
        setError("Up to 3 topics per post");
        return current;
      }
      return [...current, slug];
    });
  }

  function toggleAdditionalCircle(targetId: string) {
    setError(null);
    setAdditionalCircleIds((current) => {
      if (current.includes(targetId)) {
        return current.filter((id) => id !== targetId);
      }
      if (current.length >= 4) {
        setError("You can share a post with up to 5 circles");
        return current;
      }
      return [...current, targetId];
    });
  }

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
      const sizeBytes = item.fileSize ?? fileInfo.size ?? 0;
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
        throw new Error(`Could not upload ${item.fileName}`);
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

  const primaryCircle = circles.find((circle) => circle.id === circleId);
  const optionalCircles = circles.filter((circle) => circle.id !== circleId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.privacyCard, cardShadow()]}>
        <Ionicons name="eye-off-outline" size={20} color={theme.primary} />
        <View style={styles.privacyText}>
          <Text style={styles.privacyTitle}>Posted anonymously</Text>
          <Text style={styles.privacySubtitle}>
            Your handle is shown, not your name or contact details.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>What kind of post?</Text>
      <View style={styles.tagGrid}>
        {POST_TAGS.map((t) => {
          const active = tag === t.value;
          return (
            <Pressable
              key={t.value}
              style={[
                styles.tagOption,
                active && { backgroundColor: t.bg, borderColor: t.color },
              ]}
              onPress={() => setTag(t.value)}
            >
              <Ionicons
                name={t.icon}
                size={18}
                color={active ? t.color : theme.textMuted}
              />
              <Text
                style={[
                  styles.tagOptionText,
                  active && { color: t.color, fontWeight: "700" },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Your message</Text>
      <View style={[styles.inputWrap, cardShadow()]}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question, share a recommendation, or give a heads up…"
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          value={body}
          onChangeText={setBody}
        />
        <Text style={styles.charCount}>{body.length} characters</Text>
      </View>

      <View style={styles.attachmentHeader}>
        <Text style={[styles.sectionLabel, styles.attachmentLabel]}>
          Photos & videos
        </Text>
        <Text style={styles.attachmentCount}>{media.length}/4</Text>
      </View>
      <Pressable
        style={[
          styles.addMediaButton,
          mediaEnabled === false && styles.addMediaButtonDisabled,
        ]}
        onPress={pickMedia}
        disabled={mediaEnabled !== true}
      >
        <Ionicons
          name="images-outline"
          size={20}
          color={mediaEnabled === false ? theme.tabInactive : theme.primary}
        />
        <View style={styles.addMediaText}>
          <Text
            style={[
              styles.addMediaTitle,
              mediaEnabled === false && styles.addMediaTitleDisabled,
            ]}
          >
            Add photos or videos
          </Text>
          <Text style={styles.addMediaHint}>
            {mediaEnabled === null
              ? "Checking upload availability…"
              : mediaEnabled
                ? "Up to 4 files · Images 10 MB · Videos 100 MB"
                : "S3 and CDN configuration required"}
          </Text>
        </View>
        <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
      </Pressable>

      {media.length > 0 ? (
        <View style={styles.mediaGrid}>
          {media.map((item, index) => (
            <View key={`${item.uri}-${index}`} style={styles.mediaPreview}>
              {item.mediaType === "image" ? (
                <Image source={{ uri: item.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.videoPreview}>
                  <Ionicons name="play-circle" size={34} color="#fff" />
                  <Text style={styles.videoLabel}>Video</Text>
                </View>
              )}
              <Pressable
                style={styles.removeMedia}
                onPress={() =>
                  setMedia((current) =>
                    current.filter((_, mediaIndex) => mediaIndex !== index)
                  )
                }
              >
                <Ionicons name="close" size={15} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {uploadProgress ? (
        <View style={styles.uploadProgress}>
          <Ionicons name="cloud-upload-outline" size={17} color={theme.primary} />
          <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.pollToggle}
        onPress={() => setPollEnabled((current) => !current)}
      >
        <Ionicons
          name={pollEnabled ? "checkbox" : "square-outline"}
          size={20}
          color={theme.primary}
        />
        <Text style={styles.pollToggleText}>Add a poll</Text>
      </Pressable>

      {pollEnabled ? (
        <View style={[styles.pollPanel, cardShadow()]}>
          <Text style={styles.sectionLabel}>Poll question</Text>
          <TextInput
            style={styles.pollInput}
            placeholder="e.g. How much are you paying for maths tuition?"
            placeholderTextColor={theme.textMuted}
            value={pollQuestion}
            onChangeText={setPollQuestion}
          />
          <Text style={styles.sectionLabel}>Options</Text>
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
              style={styles.addPollOption}
              onPress={() =>
                setPollOptions((current) =>
                  current.length < 6 ? [...current, ""] : current
                )
              }
            >
              <Text style={styles.addPollOptionText}>Add option</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.sharePanel, cardShadow()]}>
        <View style={styles.shareHeading}>
          <View>
            <Text style={styles.shareTitle}>Send this post to</Text>
            <Text style={styles.shareHint}>
              Choose separately for every post
            </Text>
          </View>
          <Text style={styles.shareCount}>
            {additionalCircleIds.length + 1}/5
          </Text>
        </View>

        <View style={styles.circleTags}>
          <View style={[styles.circleTag, styles.circleTagPrimary]}>
            <Ionicons name="lock-closed" size={12} color={theme.primaryDark} />
            <Text style={styles.circleTagPrimaryText} numberOfLines={1}>
              {primaryCircle?.displayName ?? title ?? "Current circle"}
            </Text>
          </View>

          {optionalCircles.map((circle) => {
            const selected = additionalCircleIds.includes(circle.id);
            return (
              <Pressable
                key={circle.id}
                style={[
                  styles.circleTag,
                  selected && styles.circleTagSelected,
                ]}
                onPress={() => toggleAdditionalCircle(circle.id)}
              >
                <Ionicons
                  name={selected ? "close" : "add"}
                  size={14}
                  color={selected ? theme.primaryDark : theme.textMuted}
                />
                <Text
                  style={[
                    styles.circleTagText,
                    selected && styles.circleTagSelectedText,
                  ]}
                  numberOfLines={1}
                >
                  {circle.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {topicOptions.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Topics (optional, max 3)</Text>
          <View style={styles.circleTags}>
            {topicOptions.slice(0, 24).map((topic) => {
              const selected = selectedTopicSlugs.includes(topic.slug);
              return (
                <Pressable
                  key={topic.slug}
                  style={[
                    styles.circleTag,
                    selected && styles.circleTagSelected,
                  ]}
                  onPress={() => toggleTopic(topic.slug)}
                >
                  <Text
                    style={[
                      styles.circleTagText,
                      selected && styles.circleTagSelectedText,
                    ]}
                  >
                    {topic.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <PrimaryButton
        label={`Post to ${additionalCircleIds.length + 1} circle${
          additionalCircleIds.length > 0 ? "s" : ""
        }`}
        icon="paper-plane-outline"
        onPress={onSubmit}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 40 },
  sharePanel: {
    backgroundColor: theme.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  shareHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.text,
  },
  shareHint: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  shareCount: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.primary,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  circleTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  circleTag: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  circleTagPrimary: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primaryLight,
  },
  circleTagSelected: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary,
  },
  circleTagText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
    flexShrink: 1,
  },
  circleTagPrimaryText: {
    fontSize: 12,
    color: theme.primaryDark,
    fontWeight: "700",
    flexShrink: 1,
  },
  circleTagSelectedText: {
    color: theme.primaryDark,
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
  },
  privacyText: { flex: 1 },
  privacyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },
  privacySubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textMuted,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  tagOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.card,
    minWidth: "47%",
    flexGrow: 1,
  },
  tagOptionText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "500",
  },
  inputWrap: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 20,
  },
  input: {
    padding: 16,
    minHeight: 160,
    fontSize: 16,
    color: theme.text,
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: theme.textMuted,
    paddingHorizontal: 16,
    paddingBottom: 12,
    textAlign: "right",
  },
  attachmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attachmentLabel: { marginBottom: 8 },
  attachmentCount: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 8,
  },
  addMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  addMediaButtonDisabled: {
    borderColor: theme.border,
    backgroundColor: theme.borderLight,
  },
  addMediaText: { flex: 1 },
  addMediaTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  addMediaTitleDisabled: { color: theme.textMuted },
  addMediaHint: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  mediaPreview: {
    width: "48%",
    aspectRatio: 1.35,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.text,
  },
  previewImage: { width: "100%", height: "100%" },
  videoPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.textMuted,
  },
  videoLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  removeMedia: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.primarySoft,
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
  },
  uploadProgressText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primaryDark,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  error: { color: theme.error, fontSize: 14 },
  pollToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pollToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  pollPanel: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  pollInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.text,
    marginBottom: 8,
  },
  addPollOption: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  addPollOptionText: {
    color: theme.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
