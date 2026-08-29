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
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ExpertSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof api.getExpertSession>
  > | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.askExpertQuestion(token, id, text);
      setQuestion("");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) {
    return <ScreenLoader label="Loading session" />;
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

      <SafetyNotice
        tone="info"
        message="Questions are anonymous to other parents. Upvote helpful questions so the expert can prioritize them."
      />

      {session.questions.map((q) => (
        <View key={q.id} style={styles.qCard}>
          <Text style={styles.qHandle}>{q.askerHandle}</Text>
          <Text style={styles.qBody}>{q.body}</Text>
          {q.answerBody ? (
            <Text style={styles.answer}>Answer: {q.answerBody}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Upvote question, ${q.upvoteCount} votes`}
            style={styles.upvoteBtn}
            onPress={async () => {
              const token = await getToken();
              if (!token) return;
              await api.upvoteExpertQuestion(token, q.id);
              await load();
            }}
          >
            <Ionicons name="caret-up" size={16} color={colors.primary} />
            <Text style={styles.upvote}>{q.upvoteCount}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.label}>Your question</Text>
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask anonymously…"
        placeholderTextColor={colors.textSubtle}
        multiline
        accessibilityLabel="Expert question"
      />
      <Button
        label="Submit question"
        onPress={onAsk}
        loading={submitting}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  expert: {
    ...typography.supporting,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  body: {
    ...typography.body,
    lineHeight: 22,
    color: colors.text,
    fontFamily: typography.regular,
  },
  qCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qHandle: {
    ...typography.supporting,
    fontFamily: typography.semibold,
    color: colors.primary,
  },
  qBody: {
    ...typography.body,
    marginTop: spacing.xs,
    lineHeight: 22,
    color: colors.text,
    fontFamily: typography.regular,
  },
  answer: {
    ...typography.supporting,
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: typography.regular,
  },
  upvoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  upvote: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
  },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 88,
    textAlignVertical: "top",
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
  },
  cta: { marginTop: spacing.xs },
});
