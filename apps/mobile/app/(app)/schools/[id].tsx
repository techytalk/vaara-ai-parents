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
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/constants/theme";
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
  const [feeRange, setFeeRange] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [p, r, fees] = await Promise.all([
          api.getSchoolProfile(token, id),
          api.getSchoolReviews(token, id),
          api.getSchoolFees(token, id),
        ]);
        setProfile(p);
        setReviews(r.reviews);
        if (fees.current) {
          setFeeRange(
            `₹${fees.current.min.toLocaleString("en-IN")} – ₹${fees.current.max.toLocaleString("en-IN")} (${fees.current.reportedCount} parents reported)`
          );
        }
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
      const result = await api.askSchoolQuestion(token, id, text);
      setQuestion("");
      Alert.alert(
        "Question posted",
        "Current parents can reply in their school circle. You'll only see replies to your question.",
        [{ text: "OK" }]
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not post");
    }
  }

  if (loading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{profile.displayLabel}</Text>
      {profile.ratingAvg != null ? (
        <Text style={styles.rating}>
          ★ {profile.ratingAvg.toFixed(1)} · {profile.ratingCount} reviews
        </Text>
      ) : (
        <Text style={styles.meta}>Not enough reviews yet</Text>
      )}

      <Text style={styles.section}>Fees (parent-reported range)</Text>
      <Text style={styles.body}>
        {feeRange ??
          "No fee range yet — needs at least 3 parent reports for this year."}
      </Text>

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

      <Text style={styles.section}>Recent reviews</Text>
      {reviews.length === 0 ? (
        <Text style={styles.meta}>No reviews yet.</Text>
      ) : (
        reviews.slice(0, 5).map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <Text style={styles.reviewMeta}>
              ★ {review.rating}
              {review.attendanceVerified ? " · Verified parent" : ""}
            </Text>
            {review.body ? (
              <Text style={styles.body}>{review.body}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.section}>Ask current parents</Text>
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
      />
      <Pressable style={styles.primaryBtn} onPress={onAsk}>
        <Text style={styles.primaryBtnText}>Post question</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.push("/(app)/calendar")}
      >
        <Text style={styles.secondaryBtnText}>School calendar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  rating: { fontSize: 16, color: colors.primary, marginTop: 8, fontWeight: "600" },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  section: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  linkBtn: { marginTop: 12 },
  linkBtnText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewMeta: { fontSize: 13, fontWeight: "600", color: colors.primary },
  input: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { marginTop: 16, alignItems: "center" },
  secondaryBtnText: { color: colors.primary, fontWeight: "600" },
});
