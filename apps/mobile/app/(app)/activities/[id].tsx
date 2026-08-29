import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Button,
  Card,
  InlineError,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
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
          const reviewData = await api.getProviderReviews(
            token,
            detail.providerId
          );
          setReviews(reviewData.reviews);
          setRatingAvg(reviewData.provider.ratingAvg);
          setRatingCount(reviewData.provider.ratingCount);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load");
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
    } catch (cause) {
      Alert.alert("Error", cause instanceof Error ? cause.message : "Failed");
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
      const reviewData = await api.getProviderReviews(
        token,
        activity.providerId
      );
      setReviews(reviewData.reviews);
      setRatingAvg(reviewData.provider.ratingAvg);
      setRatingCount(reviewData.provider.ratingCount);
      setReviewBody("");
      Alert.alert("Thanks", "Your review was saved.");
    } catch (cause) {
      Alert.alert("Error", cause instanceof Error ? cause.message : "Failed");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <ScreenLoader />;

  if (!activity) {
    return (
      <View style={styles.centered}>
        <InlineError message={error ?? "Activity not found"} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Avatar handle={activity.provider?.orgName ?? "Provider"} size={64} />
        <View style={styles.heroCopy}>
          <Text style={styles.org}>
            {activity.provider?.orgName}
            {activity.provider?.verified ? " · Verified" : ""}
          </Text>
          <Text style={styles.type}>
            {activity.provider?.providerType ?? "Provider"}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{activity.title}</Text>

      {ratingAvg != null ? (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color={colors.amber} />
          <Text style={styles.rating}>
            {ratingAvg.toFixed(1)} ({ratingCount} reviews)
          </Text>
        </View>
      ) : null}

      {activity.startsAt ? (
        <Text style={styles.meta}>
          Starts {new Date(activity.startsAt).toLocaleString()}
        </Text>
      ) : null}
      {activity.locationText ? (
        <Text style={styles.meta}>{activity.locationText}</Text>
      ) : null}
      {activity.pinCodes.length > 0 ? (
        <Text style={styles.meta}>Serves pin {activity.pinCodes.join(", ")}</Text>
      ) : null}

      <SectionHeader title="About" />
      <Text style={styles.body}>{activity.description}</Text>

      <SectionHeader title="Reminders" />
      <View style={styles.reminderRow}>
        <Button
          label="1 day before"
          variant="secondary"
          onPress={onRemind1Day}
          disabled={savingReminder}
          style={styles.reminderBtn}
        />
        <Button
          label="1 hour before"
          variant="secondary"
          onPress={onRemind1Hour}
          disabled={savingReminder}
          style={styles.reminderBtn}
        />
      </View>

      {activity.providerId ? (
        <>
          <SectionHeader title="Parent reviews" />
          {reviews.length === 0 ? (
            <Text style={styles.meta}>No reviews yet. Be the first to share.</Text>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <Text style={styles.reviewAuthor}>
                  {review.author.anonymousHandle}
                  {review.author.contextLabel
                    ? ` · ${review.author.contextLabel}`
                    : ""}
                </Text>
                <View style={styles.reviewRatingRow}>
                  <Ionicons name="star" size={14} color={colors.amber} />
                  <Text style={styles.reviewRating}>{review.rating}</Text>
                </View>
                {review.body ? (
                  <Text style={styles.reviewBody}>{review.body}</Text>
                ) : null}
              </Card>
            ))
          )}

          <SectionHeader title="Write a review" />
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setReviewRating(star)}>
                <Ionicons
                  name={star <= reviewRating ? "star" : "star-outline"}
                  size={28}
                  color={colors.amber}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="What was helpful? Teaching style, punctuality, batch size…"
            value={reviewBody}
            onChangeText={setReviewBody}
            multiline
            placeholderTextColor={colors.textSubtle}
          />
          <Button
            label={submittingReview ? "Saving…" : "Submit review"}
            onPress={submitReview}
            loading={submittingReview}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroCopy: { flex: 1 },
  org: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  type: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    textTransform: "capitalize",
    marginTop: 2,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  rating: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 6,
  },
  body: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    lineHeight: 23,
    marginBottom: spacing.md,
  },
  reminderRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  reminderBtn: { flex: 1 },
  reviewCard: { marginBottom: spacing.xs },
  reviewAuthor: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
  },
  reviewRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  reviewRating: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  reviewBody: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: 6,
    lineHeight: 22,
  },
  starRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  reviewInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 96,
    textAlignVertical: "top",
    fontSize: 15,
    fontFamily: typography.regular,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
