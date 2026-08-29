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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  api,
  type SchoolProfile,
  type SchoolReview,
} from "@/lib/api";
import { getToken } from "@/lib/session";

export default function SchoolProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [reviews, setReviews] = useState<SchoolReview[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [p, r] = await Promise.all([
          api.getSchoolProfile(token, id),
          api.getSchoolReviews(token, id),
        ]);
        setProfile(p);
        setReviews(r.reviews);
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function onAsk() {
    const text = question.trim();
    if (!text) return;
    try {
      const token = await getToken();
      if (!token) return;
      await api.askSchoolQuestion(token, id, text);
      setQuestion("");
      Alert.alert(
        "Question posted",
        "Current parents can reply in their school circle. You'll only see replies to your question."
      );
    } catch (cause) {
      Alert.alert("Error", cause instanceof Error ? cause.message : "Could not post");
    }
  }

  if (loading || !profile) {
    return <ScreenLoader label="Loading school profile" />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroArt}>
        <Ionicons name="school" size={48} color={colors.primaryDark} />
      </View>

      <Text style={styles.title}>{profile.displayLabel}</Text>
      <Text style={styles.location}>
        {[profile.city, profile.pinCode].filter(Boolean).join(" · ")}
      </Text>

      {profile.ratingAvg != null ? (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={18} color={colors.amber} />
          <Text style={styles.rating}>
            {profile.ratingAvg.toFixed(1)} · {profile.ratingCount} parent reviews
          </Text>
        </View>
      ) : (
        <Text style={styles.meta}>Not enough reviews yet</Text>
      )}

      {profile.boardCodes.length > 0 ? (
        <>
          <SectionHeader title="Curriculum" />
          <Text style={styles.body}>{profile.boardCodes.join(" · ")}</Text>
        </>
      ) : null}

      {profile.gradesOffered ? (
        <>
          <SectionHeader title="Grades" />
          <Text style={styles.body}>{profile.gradesOffered}</Text>
        </>
      ) : null}

      {profile.transportAvailable != null ? (
        <>
          <SectionHeader title="Transport" />
          <Text style={styles.body}>
            {profile.transportAvailable ? "Transport available" : "No transport listed"}
          </Text>
        </>
      ) : null}

      <Pressable
        style={styles.linkBtn}
        onPress={() =>
          router.push({
            pathname: "/(app)/schools/review",
            params: { id },
          })
        }
      >
        <Text style={styles.linkBtnText}>Write a review</Text>
      </Pressable>

      <SectionHeader title="Parent reviews" />
      <Text style={styles.reviewHint}>
        Parents share experiences in their own words — including fees, culture,
        and academics when they choose to mention them.
      </Text>
      {reviews.length === 0 ? (
        <Text style={styles.meta}>No reviews yet.</Text>
      ) : (
        reviews.slice(0, 8).map((review) => (
          <Card key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewAuthor}>
                {review.author.anonymousHandle}
              </Text>
              <View style={styles.reviewStars}>
                <Ionicons name="star" size={12} color={colors.amber} />
                <Text style={styles.reviewRating}>{review.rating}</Text>
              </View>
            </View>
            {review.attendanceVerified ? (
              <Text style={styles.verifiedLabel}>Verified parent</Text>
            ) : null}
            {review.body ? (
              <Text style={styles.reviewBody}>{review.body}</Text>
            ) : null}
          </Card>
        ))
      )}

      <SectionHeader title="Ask current parents" />
      <Text style={styles.meta}>
        Your question goes to parents at this school. You won't see their full
        feed — only replies to you.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="What would you like to know?"
        value={question}
        onChangeText={setQuestion}
        multiline
        placeholderTextColor={colors.textSubtle}
      />
      <Button label="Post question" onPress={onAsk} />

      <Button
        label="School calendar"
        variant="secondary"
        onPress={() => router.push("/(app)/calendar")}
        style={styles.calendarBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroArt: {
    width: 88,
    height: 88,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  location: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  rating: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  body: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    lineHeight: 23,
    marginBottom: spacing.sm,
  },
  linkBtn: { marginVertical: spacing.sm },
  linkBtnText: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  reviewHint: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  reviewCard: { marginBottom: spacing.xs },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewAuthor: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
  },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 3 },
  reviewRating: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  verifiedLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    marginTop: 4,
  },
  reviewBody: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: 6,
    lineHeight: 22,
  },
  input: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 96,
    textAlignVertical: "top",
    fontSize: 15,
    fontFamily: typography.regular,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  calendarBtn: { marginTop: spacing.sm },
});
