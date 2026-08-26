import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, type Activity, type ProviderReview } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const detail = await api.getActivity(token, id);
        setActivity(detail);
        if (detail.providerId) {
          const reviewData = await api.getProviderReviews(token, detail.providerId);
          setReviews(reviewData.reviews);
          setRatingAvg(reviewData.provider.ratingAvg);
          setRatingCount(reviewData.provider.ratingCount);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function setReminder(label: string, fireAt: Date) {
    if (fireAt <= new Date()) {
      Alert.alert("Cannot set reminder in the past");
      return;
    }
    setSavingReminder(true);
    try {
      const token = await getToken();
      if (!token || !activity) return;
      await api.createReminder(token, {
        title: `Reminder: ${activity.title}`,
        note: label,
        fireAt: fireAt.toISOString(),
        activityId: activity.id,
      });
      Alert.alert("Reminder set", fireAt.toLocaleString());
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingReminder(false);
    }
  }

  function onRemind1Hour() {
    if (!activity) return;
    const base = activity.startsAt
      ? new Date(activity.startsAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fireAt = activity.startsAt
      ? new Date(base.getTime() - 60 * 60 * 1000)
      : base;
    setReminder("1 hour before", fireAt);
  }

  function onRemind1Day() {
    if (!activity) return;
    const base = activity.startsAt
      ? new Date(activity.startsAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fireAt = activity.startsAt
      ? new Date(base.getTime() - 24 * 60 * 60 * 1000)
      : base;
    setReminder("1 day before", fireAt);
  }

  async function submitReview() {
    if (!activity?.providerId) return;
    setSubmittingReview(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.submitProviderReview(token, activity.providerId, {
        rating: reviewRating,
        reviewBody: reviewBody.trim() || undefined,
      });
      const reviewData = await api.getProviderReviews(token, activity.providerId);
      setReviews(reviewData.reviews);
      setRatingAvg(reviewData.provider.ratingAvg);
      setRatingCount(reviewData.provider.ratingCount);
      setReviewBody("");
      Alert.alert("Thanks", "Your review was saved.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.centered}>
        <Text>{error ?? "Not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.org}>
        {activity.provider?.orgName}
        {activity.provider?.verified ? " · Verified" : ""}
      </Text>
      <Text style={styles.type}>{activity.provider?.providerType}</Text>
      <Text style={styles.title}>{activity.title}</Text>

      {ratingAvg != null ? (
        <Text style={styles.rating}>
          {ratingAvg.toFixed(1)} ★ ({ratingCount} reviews)
        </Text>
      ) : null}

      {activity.provider?.feeMin != null || activity.provider?.feeMax != null ? (
        <Text style={styles.fee}>
          Fee range: ₹{activity.provider?.feeMin ?? "—"} – ₹
          {activity.provider?.feeMax ?? "—"}
        </Text>
      ) : null}

      {activity.feeAmount != null && (
        <Text style={styles.fee}>
          ₹{activity.feeAmount} {activity.feeCurrency}
        </Text>
      )}

      {activity.startsAt && (
        <Text style={styles.meta}>
          Starts: {new Date(activity.startsAt).toLocaleString()}
        </Text>
      )}

      {activity.locationText && (
        <Text style={styles.meta}>Location: {activity.locationText}</Text>
      )}

      <Text style={styles.meta}>Pin codes: {activity.pinCodes.join(", ")}</Text>

      <Text style={styles.section}>Reminders</Text>
      <View style={styles.reminderRow}>
        <Pressable
          style={styles.reminderBtn}
          onPress={onRemind1Day}
          disabled={savingReminder}
        >
          <Text style={styles.reminderBtnText}>1 day before</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={onRemind1Hour}
          disabled={savingReminder}
        >
          <Text style={styles.reminderBtnText}>1 hour before</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>About</Text>
      <Text style={styles.body}>{activity.description}</Text>

      {activity.providerId ? (
        <>
          <Text style={styles.section}>Parent reviews</Text>
          {reviews.length === 0 ? (
            <Text style={styles.meta}>No reviews yet.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <Text style={styles.reviewAuthor}>
                  {review.author.anonymousHandle}
                  {review.author.contextLabel
                    ? ` · ${review.author.contextLabel}`
                    : ""}
                </Text>
                <Text style={styles.reviewRating}>{review.rating} ★</Text>
                {review.body ? (
                  <Text style={styles.reviewBody}>{review.body}</Text>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.section}>Write a review</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setReviewRating(star)}>
                <Text
                  style={[
                    styles.star,
                    star <= reviewRating && styles.starActive,
                  ]}
                >
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="What was helpful? Batch size, teaching style, punctuality…"
            value={reviewBody}
            onChangeText={setReviewBody}
            multiline
          />
          <Pressable
            style={styles.submitReview}
            onPress={submitReview}
            disabled={submittingReview}
          >
            <Text style={styles.submitReviewText}>
              {submittingReview ? "Saving…" : "Submit review"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  org: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  type: {
    fontSize: 13,
    color: "#5c5c7a",
    marginTop: 2,
    textTransform: "capitalize",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginTop: 8 },
  rating: { fontSize: 15, color: "#047857", marginTop: 8, fontWeight: "700" },
  fee: { fontSize: 16, color: "#1a1a2e", marginTop: 10 },
  meta: { fontSize: 14, color: "#5c5c7a", marginTop: 6 },
  section: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
    marginTop: 24,
    marginBottom: 8,
  },
  reminderRow: { flexDirection: "row", gap: 8 },
  reminderBtn: {
    flex: 1,
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  reminderBtnText: { color: "#4f46e5", fontWeight: "600", fontSize: 13 },
  body: { fontSize: 15, color: "#1a1a2e", lineHeight: 24 },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
    padding: 12,
    marginBottom: 8,
  },
  reviewAuthor: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  reviewRating: { fontSize: 13, color: "#047857", marginTop: 4 },
  reviewBody: { fontSize: 14, color: "#1a1a2e", marginTop: 6, lineHeight: 20 },
  starRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  star: { fontSize: 28, color: "#d4d4d8" },
  starActive: { color: "#f59e0b" },
  reviewInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 15,
    color: "#1a1a2e",
  },
  submitReview: {
    marginTop: 10,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  submitReviewText: { color: "#fff", fontWeight: "700" },
});
