import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
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
  const list = attachments ?? [];
  if (list.length === 0) return null;

  const media = list.filter(
    (item) => item.type === "image" || item.type === "video"
  );
  const documents = list.filter((item) => item.type === "document");

  return (
    <View style={styles.wrap}>
      {media.length > 0 ? (
        <MediaGrid
          items={media}
          mine={mine}
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
  onOpen,
}: {
  items: ChatMessageAttachment[];
  mine: boolean;
  onOpen: (index: number) => void;
}) {
  const count = items.length;
  if (count === 1) {
    return (
      <MediaTile
        item={items[0]}
        style={styles.single}
        mine={mine}
        onPress={() => onOpen(0)}
        label={`Photo 1 of 1`}
      />
    );
  }
  if (count === 2) {
    return (
      <View style={styles.two}>
        {items.map((item, index) => (
          <MediaTile
            key={item.id}
            item={item}
            style={styles.half}
            mine={mine}
            onPress={() => onOpen(index)}
            label={`${item.type === "video" ? "Video" : "Photo"} ${index + 1} of 2`}
          />
        ))}
      </View>
    );
  }
  if (count === 3) {
    return (
      <View style={styles.three}>
        <MediaTile
          item={items[0]}
          style={styles.threeMain}
          mine={mine}
          onPress={() => onOpen(0)}
          label={`${items[0].type === "video" ? "Video" : "Photo"} 1 of 3`}
        />
        <View style={styles.threeSide}>
          {items.slice(1).map((item, index) => (
            <MediaTile
              key={item.id}
              item={item}
              style={styles.threeSideTile}
              mine={mine}
              onPress={() => onOpen(index + 1)}
              label={`${item.type === "video" ? "Video" : "Photo"} ${index + 2} of 3`}
            />
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {items.slice(0, 4).map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          style={styles.quarter}
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
  onPress,
  label,
}: {
  item: ChatMessageAttachment;
  style: object;
  mine: boolean;
  onPress: () => void;
  label: string;
}) {
  const isVideo = item.type === "video";
  return (
    <Pressable
      style={[styles.tile, style, mine && styles.tileMine]}
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
  if (index == null || items.length === 0) return null;
  const width = Dimensions.get("window").width;

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
  single: { width: "100%", height: 240 },
  two: { flexDirection: "row", gap: 2 },
  half: { flex: 1, height: 168 },
  three: { flexDirection: "row", gap: 2, height: 220 },
  threeMain: { flex: 1.15 },
  threeSide: { flex: 1, gap: 2 },
  threeSideTile: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  quarter: { width: "49.4%", height: 118 },
  tile: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
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
