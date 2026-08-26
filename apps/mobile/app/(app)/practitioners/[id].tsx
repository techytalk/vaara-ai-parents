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
import { colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function PractitionerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof api.getPractitioner>
  > | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      setDetail(await api.getPractitioner(token, id));
      setLoading(false);
    });
  }, [id]);

  async function onRecommend() {
    try {
      const token = await getToken();
      if (!token) return;
      await api.recommendPractitioner(token, id, { note: note.trim() });
      setNote("");
      setDetail(await api.getPractitioner(token, id));
      Alert.alert("Thanks", "Your logistics note was saved.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  }

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.disclaimer}>{detail.disclaimer}</Text>
      <Text style={styles.title}>{detail.name}</Text>
      <Text style={styles.meta}>
        {detail.category}
        {detail.clinicName ? ` · ${detail.clinicName}` : ""}
      </Text>

      {detail.recommendations.map((rec) => (
        <View key={rec.id} style={styles.recCard}>
          <Text style={styles.recAuthor}>{rec.author.anonymousHandle}</Text>
          {rec.author.contextLabel ? (
            <Text style={styles.recContext}>{rec.author.contextLabel}</Text>
          ) : null}
          {rec.note ? <Text style={styles.recBody}>{rec.note}</Text> : null}
        </View>
      ))}

      <Text style={styles.section}>Add your note (logistics only)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Wait time, manner, fees — no medical advice"
      />
      <Pressable style={styles.btn} onPress={onRecommend}>
        <Text style={styles.btnText}>Share recommendation</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  disclaimer: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  recCard: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recAuthor: { fontWeight: "600", color: colors.primary },
  recContext: { fontSize: 12, color: colors.textMuted },
  recBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  section: { marginTop: 20, fontWeight: "700", color: colors.text },
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
  },
  btn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
