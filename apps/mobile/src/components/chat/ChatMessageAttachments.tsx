import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type ChatMessageAttachment } from "@/lib/api";
import { getToken } from "@/lib/session";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MEDIA_WIDTH_RATIO = 0.72;
const MAX_MEDIA_WIDTH = 280;
const MIN_SINGLE_HEIGHT = 120;
const MAX_SINGLE_HEIGHT = 320;
const MEDIA_GAP = 2;

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mimeType: string): string {
  if (mimeType === PDF_MIME) return "PDF";
  if (mimeType === DOCX_MIME) return "Word";
  if (mimeType === XLSX_MIME) return "Excel";
  return "File";
}

function iconForMime(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType === PDF_MIME) return "document-text";
  if (mimeType === DOCX_MIME) return "document";
  if (mimeType === XLSX_MIME) return "grid";
  return "attach";
}

export function attachmentQuoteLabel(
  attachments: ChatMessageAttachment[] | undefined,
  body: string | null
): string {
  const text = (body ?? "").trim();
  if (text) return text;
  const list = attachments ?? [];
  if (list.length === 0) return "";
  const photos = list.filter((item) => item.type === "image").length;
  const videos = list.filter((item) => item.type === "video").length;
  const docs = list.filter((item) => item.type === "document");
  if (photos && !videos && docs.length === 0) {
    return photos === 1 ? "Photo" : `Photos (${photos})`;
  }
  if (videos && !photos && docs.length === 0) {
    return videos === 1 ? "Video" : `Videos (${videos})`;
  }
  if (docs.length && !photos && !videos) {
    return docs.length === 1 ? docs[0].fileName ?? "Document" : `Documents (${docs.length})`;
  }
  return `Attachments (${list.length})`;
}

async function openChatDocument(attachment: ChatMessageAttachment) {
  const token = await getToken();
  if (!token) {
    Alert.alert("Sign in required", "Sign in again to open this file.");
    return;
  }
  const { downloadUrl } = await api.getChatMediaDownloadUrl(token, attachment.id);
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error("No cache directory");
  const safeName = (attachment.fileName ?? "document").replace(
    /[^\w.\- ()[\]]+/g,
    "_"
  );
  const localUri = `${cacheRoot}chat-doc-${attachment.id}-${safeName}`;
  const result = await FileSystem.downloadAsync(downloadUrl, localUri);
  const Sharing = await import("expo-sharing").catch(() => null);
  const canShare = Sharing ? await Sharing.isAvailableAsync() : false;
  if (!Sharing || !canShare) {
    Alert.alert("Saved", `File downloaded to ${result.uri}`);
    return;
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: attachment.mimeType,
    dialogTitle: attachment.fileName ?? "Document",
  });
}

async function openMedia(attachment: ChatMessageAttachment) {
  if (attachment.type === "document") {
    await openChatDocument(attachment);
    return;
  }
  let url = attachment.url;
  if (!url) {
    const token = await getToken();
    if (!token) return;
    const refreshed = await api.getChatMediaDownloadUrl(token, attachment.id);
    url = refreshed.downloadUrl;
  }
  if (url) await Linking.openURL(url);
}

export function ChatMessageAttachments({
  attachments,
  mine,
}: {
  attachments?: ChatMessageAttachment[];
  mine: boolean;
}) {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const list = attachments ?? [];
  if (list.length === 0) return null;

  const media = list.filter(
    (item) => item.type === "image" || item.type === "video"
  );
  const documents = list.filter((item) => item.type === "document");
  const mediaWidth = Math.min(
    Math.floor(windowWidth * MEDIA_WIDTH_RATIO),
    MAX_MEDIA_WIDTH
  );

  return (
    <View style={[styles.wrap, media.length > 0 && { width: mediaWidth }]}>
      {media.length > 0 ? (
        <MediaGrid
          items={media}
          mine={mine}
          width={mediaWidth}
          onOpen={(index) => setGalleryIndex(index)}
        />
      ) : null}
      {documents.map((doc) => {
        const busy = openingDocId === doc.id;
        return (
          <Pressable
            key={doc.id}
            style={[styles.docRow, mine && styles.docRowMine]}
            onPress={() => {
              if (busy) return;
              setOpeningDocId(doc.id);
              void openChatDocument(doc).finally(() => setOpeningDocId(null));
            }}
            accessibilityLabel={`Open ${doc.fileName ?? "document"}`}
          >
            <View style={styles.docIcon}>
              <Ionicons
                name={iconForMime(doc.mimeType)}
                size={18}
                color={mine ? colors.textInverse : colors.primaryDark}
              />
            </View>
            <View style={styles.docMeta}>
              <Text
                style={[styles.docName, mine && styles.docNameMine]}
                numberOfLines={1}
              >
                {doc.fileName ?? "Document"}
              </Text>
              <Text style={[styles.docSub, mine && styles.docSubMine]}>
                {typeLabel(doc.mimeType)} · {formatBytes(doc.sizeBytes)}
              </Text>
            </View>
            {busy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.docOpen, mine && styles.docOpenMine]}>Open</Text>
            )}
          </Pressable>
        );
      })}
      <GalleryModal
        items={media}
        index={galleryIndex}
        onClose={() => setGalleryIndex(null)}
      />
    </View>
  );
}

function MediaGrid({
  items,
  mine,
  width,
  onOpen,
}: {
  items: ChatMessageAttachment[];
  mine: boolean;
  width: number;
  onOpen: (index: number) => void;
}) {
  const count = items.length;
  if (count === 1) {
    const item = items[0];
    const sourceWidth = item.width;
    const sourceHeight = item.height;
    const hasDimensions =
      typeof sourceWidth === "number" &&
      sourceWidth > 0 &&
      typeof sourceHeight === "number" &&
      sourceHeight > 0;
    const naturalHeight = hasDimensions
      ? width * (sourceHeight / sourceWidth)
      : width * 0.75;
    const height = Math.max(
      MIN_SINGLE_HEIGHT,
      Math.min(MAX_SINGLE_HEIGHT, Math.round(naturalHeight))
    );
    return (
      <MediaTile
        item={item}
        style={{ width, height }}
        mine={mine}
        rounded
        onPress={() => onOpen(0)}
        label={`${item.type === "video" ? "Video" : "Photo"} 1 of 1`}
      />
    );
  }
  if (count === 2) {
    const cellWidth = Math.floor((width - MEDIA_GAP) / 2);
    const height = Math.min(180, Math.round(width * 0.6));
    return (
      <View style={[styles.mediaGroup, styles.two, { width }]}>
        {items.map((item, index) => (
          <MediaTile
            key={item.id}
            item={item}
            style={{ width: cellWidth, height }}
            mine={mine}
            onPress={() => onOpen(index)}
            label={`${item.type === "video" ? "Video" : "Photo"} ${index + 1} of 2`}
          />
        ))}
      </View>
    );
  }
  if (count === 3) {
    const height = Math.min(220, Math.round(width * 0.78));
    const availableWidth = width - MEDIA_GAP;
    const mainWidth = Math.round(availableWidth * 0.55);
    const sideWidth = availableWidth - mainWidth;
    const sideHeight = Math.floor((height - MEDIA_GAP) / 2);
    return (
      <View style={[styles.mediaGroup, styles.three, { width, height }]}>
        <MediaTile
          item={items[0]}
          style={{ width: mainWidth, height }}
          mine={mine}
          onPress={() => onOpen(0)}
          label={`${items[0].type === "video" ? "Video" : "Photo"} 1 of 3`}
        />
        <View style={[styles.threeSide, { width: sideWidth, height }]}>
          {items.slice(1).map((item, index) => (
            <MediaTile
              key={item.id}
              item={item}
              style={{ width: sideWidth, height: sideHeight }}
              mine={mine}
              onPress={() => onOpen(index + 1)}
              label={`${item.type === "video" ? "Video" : "Photo"} ${index + 2} of 3`}
            />
          ))}
        </View>
      </View>
    );
  }
  const cellSize = Math.floor((width - MEDIA_GAP) / 2);
  return (
    <View style={[styles.mediaGroup, styles.grid, { width }]}>
      {items.slice(0, 4).map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          style={{ width: cellSize, height: cellSize }}
          mine={mine}
          onPress={() => onOpen(index)}
          label={`${item.type === "video" ? "Video" : "Photo"} ${index + 1} of ${Math.min(count, 4)}`}
        />
      ))}
    </View>
  );
}

function MediaTile({
  item,
  style,
  mine,
  rounded = false,
  onPress,
  label,
}: {
  item: ChatMessageAttachment;
  style: object;
  mine: boolean;
  rounded?: boolean;
  onPress: () => void;
  label: string;
}) {
  const isVideo = item.type === "video";
  return (
    <Pressable
      style={[
        styles.tile,
        rounded && styles.tileRounded,
        style,
        mine && styles.tileMine,
      ]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {item.url && !isVideo ? (
        <Image source={{ uri: item.url }} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <View style={[styles.tileFallback, isVideo && styles.tileVideo]}>
          <Ionicons
            name={isVideo ? "play-circle" : "image-outline"}
            size={isVideo ? 36 : 28}
            color={colors.textInverse}
          />
          {isVideo && item.durationMs ? (
            <Text style={styles.duration}>{formatDuration(item.durationMs)}</Text>
          ) : null}
        </View>
      )}
      {isVideo && item.url ? (
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={18} color={colors.textInverse} />
          {item.durationMs ? (
            <Text style={styles.duration}>{formatDuration(item.durationMs)}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function GalleryModal({
  items,
  index,
  onClose,
}: {
  items: ChatMessageAttachment[];
  index: number | null;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  if (index == null || items.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.gallery}>
        <Pressable style={styles.galleryClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.textInverse} />
        </Pressable>
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={{ width, justifyContent: "center", alignItems: "center" }}
              onPress={() => void openMedia(item)}
            >
              {item.type === "image" && item.url ? (
                <Image
                  source={{ uri: item.url }}
                  style={{ width: width - 24, height: "70%" }}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.galleryVideo}>
                  <Ionicons name="play-circle" size={64} color={colors.textInverse} />
                  <Text style={styles.galleryHint}>
                    Tap to play
                    {item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ""}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginBottom: 2 },
  mediaGroup: { borderRadius: 12, overflow: "hidden" },
  two: { flexDirection: "row", gap: MEDIA_GAP },
  three: { flexDirection: "row", gap: MEDIA_GAP },
  threeSide: { gap: MEDIA_GAP },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: MEDIA_GAP },
  tile: {
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  tileRounded: { borderRadius: 12 },
  tileMine: { backgroundColor: "rgba(0,0,0,0.25)" },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textMuted,
    minHeight: 80,
  },
  tileVideo: { backgroundColor: "#1a1a1a" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    gap: 4,
  },
  duration: {
    position: "absolute",
    right: 6,
    bottom: 6,
    color: colors.textInverse,
    fontFamily: typography.semibold,
    fontSize: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docRowMine: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "transparent",
  },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  docMeta: { flex: 1, minWidth: 0 },
  docName: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 13,
  },
  docNameMine: { color: colors.textInverse },
  docSub: {
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  docSubMine: { color: "rgba(255,255,255,0.75)" },
  docOpen: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
    fontSize: 12,
  },
  docOpenMine: { color: colors.textInverse },
  gallery: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    paddingTop: spacing.xl,
  },
  galleryClose: {
    alignSelf: "flex-end",
    marginRight: spacing.md,
    marginBottom: spacing.sm,
  },
  galleryVideo: { alignItems: "center", gap: 12 },
  galleryHint: {
    color: colors.textInverse,
    fontFamily: typography.medium,
    fontSize: 14,
  },
});
