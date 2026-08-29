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
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, Card, ScreenLoader, SectionHeader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function PractitionerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof api.getPractitioner>
  > | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      setDetail(await api.getPractitioner(token, id));
      setLoading(false);
    });
  }, [id]);

  async function onRecommend() {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.recommendPractitioner(token, id, { note: note.trim() });
      setNote("");
      setDetail(await api.getPractitioner(token, id));
      Alert.alert("Thanks", "Your logistics note was saved.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !detail) {
    return <ScreenLoader label="Loading practitioner" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafetyNotice tone="warning" message={detail.disclaimer} />

      <Text style={styles.title}>{detail.name}</Text>
      <Text style={styles.meta}>
        {detail.category}
        {detail.clinicName ? ` · ${detail.clinicName}` : ""}
      </Text>

      <SectionHeader title="Parent notes" />
      {detail.recommendations.length === 0 ? (
        <Text style={styles.empty}>
          No parent logistics notes yet for this practitioner.
        </Text>
      ) : (
        detail.recommendations.map((rec) => (
          <Card key={rec.id} style={styles.recCard}>
            <Text style={styles.recAuthor}>{rec.author.anonymousHandle}</Text>
            {rec.author.contextLabel ? (
              <Text style={styles.recContext}>{rec.author.contextLabel}</Text>
            ) : null}
            {rec.note ? <Text style={styles.recBody}>{rec.note}</Text> : null}
          </Card>
        ))
      )}

      <SectionHeader title="Add your note" />
      <Text style={styles.hint}>Logistics only — wait times, manner, fees.</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Wait time, manner, fees — no medical advice"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Recommendation note"
      />
      <Button
        label="Share recommendation"
        onPress={onRecommend}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  title: {
    ...typography.screenTitle,
    color: colors.navy,
    fontFamily: typography.bold,
    fontSize: 22,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textTransform: "capitalize",
  },
  empty: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  recCard: { marginBottom: spacing.xs },
  recAuthor: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  recContext: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  recBody: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  hint: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
  },
});
