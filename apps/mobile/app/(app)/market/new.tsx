import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { PrimaryButton, theme } from "@/components/circles/ui";
import { colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

const KINDS = [
  { value: "for_sale", label: "For sale" },
  { value: "free", label: "Free" },
  { value: "wanted", label: "Wanted" },
] as const;

const CATEGORIES = [
  "textbooks",
  "uniforms",
  "sports",
  "instruments",
  "toys",
  "furniture",
  "other",
] as const;

type PendingPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
};

export default function NewListingScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("for_sale");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      const status = await api.getMediaStatus(token).catch(() => ({
        configured: false,
      }));
      setMediaEnabled(status.configured);
    });
  }, []);

  async function pickPhotos() {
    if (!mediaEnabled) {
      setError("Photo uploads require storage configuration");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to add listing images");
      return;
    }
    if (photos.length >= 5) {
      setError("Up to 5 photos allowed");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    const selected = result.assets.map((asset, index) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? `listing-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileSize: asset.fileSize ?? 0,
      width: asset.width,
      height: asset.height,
    }));
    setPhotos((current) => [...current, ...selected].slice(0, 5));
  }

  async function uploadPhotos(token: string) {
    const uploaded: Array<{
      storageKey: string;
      mimeType: string;
      width?: number;
      height?: number;
    }> = [];

    for (const photo of photos) {
      const info = await FileSystem.getInfoAsync(photo.uri);
      const sizeBytes =
        photo.fileSize ||
        (info.exists && "size" in info ? Number(info.size) : 0);
      const upload = await api.createMediaUpload(token, {
        fileName: photo.fileName,
        mediaType: "image",
        mimeType: photo.mimeType,
        sizeBytes,
        purpose: "listing",
      });
      await FileSystem.uploadAsync(upload.uploadUrl, photo.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": photo.mimeType },
      });
      uploaded.push({
        storageKey: upload.storageKey,
        mimeType: photo.mimeType,
        width: photo.width,
        height: photo.height,
      });
    }
    return uploaded;
  }

  async function onSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    if (kind === "for_sale" && !price.trim()) {
      setError("Enter a price for items for sale");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const media = photos.length > 0 ? await uploadPhotos(token) : [];
      await api.createListing(token, {
        kind,
        category,
        title: trimmedTitle,
        description: description.trim() || undefined,
        priceAmount:
          kind === "for_sale" ? Number(price.replace(/[^\d.]/g, "")) : undefined,
        media,
      });
      Alert.alert("Posted", "Your listing is live in your community.");
      router.replace("/(app)/market");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {KINDS.map((item) => (
          <Pressable
            key={item.value}
            style={[styles.chip, kind === item.value && styles.chipActive]}
            onPress={() => setKind(item.value)}
          >
            <Text
              style={[
                styles.chipText,
                kind === item.value && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {CATEGORIES.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, category === value && styles.chipActive]}
              onPress={() => setCategory(value)}
            >
              <Text
                style={[
                  styles.chipText,
                  category === value && styles.chipTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. CBSE Class 5 maths workbook"
        maxLength={120}
      />

      {kind === "for_sale" ? (
        <>
          <Text style={styles.label}>Price (₹)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="500"
          />
        </>
      ) : null}

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Condition, pickup notes, etc."
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.photoRow}>
          {photos.map((photo) => (
            <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.photo} />
          ))}
          {photos.length < 5 ? (
            <Pressable style={styles.addPhoto} onPress={pickPhotos}>
              <Text style={styles.addPhotoText}>+ Add</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={loading ? "Posting…" : "Post listing"}
        onPress={onSubmit}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: theme.primary },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  photoRow: { flexDirection: "row", gap: 8 },
  photo: { width: 72, height: 72, borderRadius: 10 },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  addPhotoText: { color: colors.primary, fontWeight: "600" },
  error: { color: "#dc2626", marginTop: 12 },
});
