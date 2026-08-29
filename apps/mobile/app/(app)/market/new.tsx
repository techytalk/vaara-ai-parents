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
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, Chip, InlineError, SectionHeader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
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
    trackEvent("circle_post_started", { surface: "market_new" });
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
      const info = await FileSystem.getInfoAsync(photo.uri, { size: true });
      const sizeBytes =
        (info.exists && "size" in info ? Number(info.size) : 0) ||
        photo.fileSize ||
        0;
      if (!sizeBytes) {
        throw new Error(`Could not read file size for ${photo.fileName}`);
      }
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
      trackEvent("market_listing_posted", { kind, category });
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
      <SafetyNotice
        tone="info"
        message="Listings are visible to parents in your community. Contact details are shared only after both sides agree in chat."
      />

      <SectionHeader title="Listing type" />
      <View style={styles.chipRow}>
        {KINDS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={kind === item.value}
            onPress={() => setKind(item.value)}
          />
        ))}
      </View>

      <SectionHeader title="Category" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
      </ScrollView>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. CBSE Class 5 maths workbook"
        placeholderTextColor={colors.textSubtle}
        maxLength={120}
        accessibilityLabel="Listing title"
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
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Listing price"
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
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Listing description"
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.photoRow}>
          {photos.map((photo) => (
            <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.photo} />
          ))}
          {photos.length < 5 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add listing photos"
              style={styles.addPhoto}
              onPress={pickPhotos}
            >
              <Ionicons name="add" size={24} color={colors.coral} />
              <Text style={styles.addPhotoText}>Add</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {error ? <InlineError message={error} /> : null}

      <Button
        label="Post listing"
        variant="coral"
        onPress={onSubmit}
        loading={loading}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  photoRow: { flexDirection: "row", gap: spacing.xs },
  photo: { width: 80, height: 80, borderRadius: radii.md },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    gap: 2,
  },
  addPhotoText: {
    ...typography.caption,
    color: colors.coral,
    fontFamily: typography.semibold,
  },
  cta: { marginTop: spacing.md },
});
