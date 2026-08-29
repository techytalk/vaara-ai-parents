import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PostMediaGallery } from "@/components/circles/ui";
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { listingKindLabel, listingPriceLabel } from "@/lib/market-display";
import { trackEvent } from "@/lib/analytics";
import { api, type Listing } from "@/lib/api";
import { getToken } from "@/lib/session";

function kindAccent(kind: Listing["kind"]) {
  if (kind === "free") return colors.teal;
  if (kind === "wanted") return colors.lavender;
  return colors.coral;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackEvent("market_listing_opened", { listingId: id });
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
    return <ScreenLoader label="Loading listing" />;
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
        <View
          style={[
            styles.kindBadge,
            { backgroundColor: `${kindAccent(listing.kind)}18` },
          ]}
        >
          <Text
            style={[styles.kindBadgeText, { color: kindAccent(listing.kind) }]}
          >
            {listingKindLabel(listing.kind)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove saved listing" : "Save listing"}
          onPress={toggleSave}
          hitSlop={8}
        >
          <Text style={styles.saveLink}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>

      <Text
        style={[
          styles.price,
          listing.kind === "free" && styles.priceFree,
        ]}
      >
        {listingPriceLabel(listing)}
      </Text>
      <Text style={styles.title}>{listing.title}</Text>
      {listing.description ? (
        <Text style={styles.description}>{listing.description}</Text>
      ) : null}

      <Text style={styles.meta}>
        {listing.category.replace("_", " ")} · Expires{" "}
        {new Date(listing.expiresAt).toLocaleDateString()}
      </Text>

      {!listing.isMine ? (
        <Button
          label="I'm interested"
          onPress={onInterest}
          loading={submitting}
          style={styles.cta}
        />
      ) : (
        <Text style={styles.mineHint}>This is your listing.</Text>
      )}

      <SafetyNotice
        tone="info"
        message="To arrange handover, both of you will need to share first name and flat number in chat. Phone numbers stay hidden unless you choose carpool disclosure later."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  placeholder: {
    height: 180,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  kindBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  kindBadgeText: {
    ...typography.caption,
    fontFamily: typography.semibold,
    textTransform: "uppercase",
  },
  price: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
    fontSize: 24,
  },
  priceFree: { color: colors.teal },
  saveLink: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    lineHeight: 26,
  },
  description: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    lineHeight: 22,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textTransform: "capitalize",
  },
  cta: { marginTop: spacing.sm },
  mineHint: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
});
