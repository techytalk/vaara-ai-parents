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

export default function ExpertSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof api.getExpertSession>
  > | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    setSession(await api.getExpertSession(token, id));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function onAsk() {
    const text = question.trim();
    if (!text) return;
    try {
      const token = await getToken();
      if (!token) return;
      await api.askExpertQuestion(token, id, text);
      setQuestion("");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not submit");
    }
  }

  if (loading || !session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{session.title}</Text>
      <Text style={styles.expert}>
        {session.expert.displayName} · {session.expert.credentials}
      </Text>
      {session.description ? (
        <Text style={styles.body}>{session.description}</Text>
      ) : null}

      {session.questions.map((q) => (
        <View key={q.id} style={styles.qCard}>
          <Text style={styles.qHandle}>{q.askerHandle}</Text>
          <Text style={styles.qBody}>{q.body}</Text>
          {q.answerBody ? (
            <Text style={styles.answer}>Answer: {q.answerBody}</Text>
          ) : null}
          <Pressable
            onPress={async () => {
              const token = await getToken();
              if (!token) return;
              await api.upvoteExpertQuestion(token, q.id);
              await load();
            }}
          >
            <Text style={styles.upvote}>▲ {q.upvoteCount}</Text>
          </Pressable>
        </View>
      ))}

      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask anonymously…"
        multiline
      />
      <Pressable style={styles.btn} onPress={onAsk}>
        <Text style={styles.btnText}>Submit question</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  expert: { fontSize: 14, color: colors.primary, marginTop: 6 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 12, color: colors.text },
  qCard: {
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qHandle: { fontWeight: "600", color: colors.primary },
  qBody: { marginTop: 6, fontSize: 15, lineHeight: 22 },
  answer: { marginTop: 8, fontSize: 14, color: colors.text },
  upvote: { marginTop: 8, color: colors.textMuted, fontWeight: "600" },
  input: {
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 80,
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
