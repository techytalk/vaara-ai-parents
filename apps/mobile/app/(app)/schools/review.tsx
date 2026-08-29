import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function SchoolReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(4);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.submitSchoolReview(token, id, { rating, reviewBody: body });
      router.back();
    } catch {
      // Button shows loading state; user can retry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Write a review</Text>
      <Text style={styles.hint}>
        Share your experience in your own words. You can mention fees, culture,
        academics, or anything that would help other parents.
      </Text>

      <Text style={styles.label}>Rating</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setRating(value)}>
            <Ionicons
              name={value <= rating ? "star" : "star-outline"}
              size={32}
              color={colors.amber}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Your experience (optional)</Text>
      <TextInput
        style={styles.input}
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="What should other parents know?"
        placeholderTextColor={colors.textSubtle}
      />

      <Button
        label={submitting ? "Saving…" : "Submit review"}
        onPress={onSubmit}
        loading={submitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.sm,
  },
  stars: { flexDirection: "row", gap: 8, marginTop: spacing.xs },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 15,
    fontFamily: typography.regular,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
