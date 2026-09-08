import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { theme } from "@/components/circles/ui";
import { api, type CirclePostDocument } from "@/lib/api";
import { getToken } from "@/lib/session";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function iconForMime(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType === PDF_MIME) return "document-text";
  if (mimeType === DOCX_MIME) return "document";
  if (mimeType === XLSX_MIME) return "grid";
  return "attach";
}

function typeLabel(mimeType: string): string {
  if (mimeType === PDF_MIME) return "PDF";
  if (mimeType === DOCX_MIME) return "Word";
  if (mimeType === XLSX_MIME) return "Excel";
  return "File";
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PostDocumentList({
  documents,
}: {
  documents?: CirclePostDocument[];
}) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  if (!documents || documents.length === 0) return null;

  async function openDocument(doc: CirclePostDocument) {
    if (openingId) return;
    setOpeningId(doc.id);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign in required", "Sign in again to open this file.");
        return;
      }
      const { downloadUrl } = await api.getDocumentDownloadUrl(token, doc.id);
      const cacheRoot = FileSystem.cacheDirectory;
      if (!cacheRoot) {
        throw new Error("No cache directory");
      }
      const safeName = doc.fileName.replace(/[^\w.\- ()[\]]+/g, "_");
      const localUri = `${cacheRoot}doc-${doc.id}-${safeName}`;
      const result = await FileSystem.downloadAsync(downloadUrl, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Saved", `File downloaded to ${result.uri}`);
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: doc.mimeType,
        dialogTitle: doc.fileName,
        UTI:
          doc.mimeType === PDF_MIME
            ? "com.adobe.pdf"
            : doc.mimeType === DOCX_MIME
              ? "org.openxmlformats.wordprocessingml.document"
              : doc.mimeType === XLSX_MIME
                ? "org.openxmlformats.spreadsheetml.sheet"
                : undefined,
      });
    } catch (error) {
      Alert.alert(
        "Could not open file",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <View style={styles.list}>
      {documents.map((doc) => {
        const busy = openingId === doc.id;
        return (
          <View key={doc.id} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={iconForMime(doc.mimeType)}
                size={20}
                color={theme.primaryDark}
              />
            </View>
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {doc.fileName}
              </Text>
              <Text style={styles.sub}>
                {typeLabel(doc.mimeType)} · {formatBytes(doc.sizeBytes)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${doc.fileName}`}
              style={styles.openBtn}
              disabled={busy}
              onPress={() => void openDocument(doc)}
            >
              {busy ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.openText}>Open</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 10 },
  row: {
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
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceMuted,
  },
  meta: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    color: theme.textMuted,
  },
  openBtn: {
    minWidth: 56,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primarySoft,
  },
  openText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.primaryDark,
  },
});
