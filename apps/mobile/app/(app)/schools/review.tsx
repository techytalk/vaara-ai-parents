import { useState } from "react";
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
import { colors } from "@/constants/theme";
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
      Alert.alert("Thanks", "Your review was saved.");
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Rating</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setRating(value)}>
            <Text style={[styles.star, value <= rating && styles.starActive]}>
              ★
            </Text>
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
      />
      <Pressable
        style={[styles.btn, submitting && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        <Text style={styles.btnText}>
          {submitting ? "Saving…" : "Submit review"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textMuted, marginTop: 12 },
  stars: { flexDirection: "row", gap: 8, marginTop: 8 },
  star: { fontSize: 32, color: colors.border },
  starActive: { color: "#f59e0b" },
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 15,
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
});
