import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { PostMediaGallery } from "@/components/circles/ui";
import { api, type Listing } from "@/lib/api";
import { getToken } from "@/lib/session";

function priceLabel(listing: Listing) {
  if (listing.kind === "free") return "Free to take";
  if (listing.kind === "wanted") return "Wanted";
  if (listing.priceAmount != null) {
    return `₹${listing.priceAmount.toLocaleString("en-IN")}`;
  }
  return "Price on request";
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setListing(await api.getListing(token, id));
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function toggleSave() {
    const token = await getToken();
    if (!token) return;
    try {
      if (saved) {
        await api.unsaveItem(token, "listing", id);
        setSaved(false);
      } else {
        await api.saveItem(token, { itemType: "listing", itemId: id });
        setSaved(true);
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update save");
    }
  }

  async function onInterest() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.expressListingInterest(token, id);
      router.push({
        pathname: "/(app)/messages/[conversationId]",
        params: {
          conversationId: result.conversationId,
          peerHandle: result.peer.anonymousHandle,
        },
      });
    } catch (e) {
      Alert.alert(
        "Could not start chat",
        e instanceof Error ? e.message : "Please try again"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !listing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {listing.media.length > 0 ? (
        <PostMediaGallery
          media={listing.media.map((m) => ({
            id: m.id,
            type: "image" as const,
            url: m.url,
            mimeType: m.mimeType,
            width: m.width,
            height: m.height,
            durationMs: null,
          }))}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photos</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <Text
          style={[
            styles.price,
            listing.kind === "free" && styles.priceFree,
          ]}
        >
          {priceLabel(listing)}
        </Text>
        <Pressable onPress={toggleSave} hitSlop={8}>
          <Text style={styles.saveLink}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{listing.title}</Text>
      {listing.description ? (
        <Text style={styles.description}>{listing.description}</Text>
      ) : null}

      <Text style={styles.meta}>
        {listing.category.replace("_", " ")} · Expires{" "}
        {new Date(listing.expiresAt).toLocaleDateString()}
      </Text>

      {!listing.isMine ? (
        <Pressable
          style={[styles.interestBtn, submitting && styles.interestBtnDisabled]}
          onPress={onInterest}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.interestBtnText}>I'm interested</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.mineHint}>This is your listing.</Text>
      )}

      <Text style={styles.disclosureHint}>
        To arrange handover, both of you will need to share first name and flat
        number in the chat. Phone numbers stay hidden unless you choose carpool
        disclosure later.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholder: {
    height: 180,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  placeholderText: { color: colors.textMuted },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  price: { fontSize: 22, fontWeight: "700", color: colors.text },
  priceFree: { color: "#047857" },
  saveLink: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
    lineHeight: 26,
  },
  description: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginTop: 10,
  },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 12 },
  interestBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  interestBtnDisabled: { opacity: 0.6 },
  interestBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  mineHint: {
    marginTop: 20,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  disclosureHint: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
