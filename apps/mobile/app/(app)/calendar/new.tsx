import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { DateTimeField } from "@/components/DateTimeField";
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, Chip, SectionHeader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Child } from "@/lib/api";
import { getToken } from "@/lib/session";

const EVENT_TYPES = [
  { value: "exam", label: "Exam" },
  { value: "ptm", label: "PTM" },
  { value: "holiday", label: "Holiday" },
  { value: "fee_due", label: "Fee due" },
  { value: "event", label: "Event" },
  { value: "deadline", label: "Deadline" },
];

export default function NewSchoolEventScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("event");
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      const kids = await api.getChildren(token);
      setChildren(kids);
      if (kids[0]?.schoolId) setSchoolId(kids[0].schoolId);
    });
  }, []);

  async function onSubmit() {
    if (!schoolId || !title.trim() || !startsAt) {
      Alert.alert("Missing fields", "Title and start date/time are required.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.reportSchoolEvent(token, schoolId, {
        title: title.trim(),
        eventType,
        startsAt: startsAt.toISOString(),
        description: description.trim() || undefined,
      });
      Alert.alert("Thanks", "Other parents can confirm this event.");
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafetyNotice
        tone="info"
        message="Parent-reported events stay labelled unconfirmed until three parents confirm them."
      />

      {children.length > 1 ? (
        <>
          <SectionHeader title="Child's school" />
          <View style={styles.chipRow}>
            {children.map((child) => (
              <Chip
                key={child.id}
                label={child.school.displayLabel}
                selected={schoolId === child.schoolId}
                onPress={() => setSchoolId(child.schoolId)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Grade 6 PTM"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Event title"
      />

      <SectionHeader title="Event type" />
      <View style={styles.chipRow}>
        {EVENT_TYPES.map((type) => (
          <Chip
            key={type.value}
            label={type.label}
            selected={eventType === type.value}
            onPress={() => setEventType(type.value)}
          />
        ))}
      </View>

      <DateTimeField
        label="Starts at"
        value={startsAt}
        onChange={setStartsAt}
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="What should other parents know?"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Event notes"
      />

      <Button
        label="Report event"
        onPress={onSubmit}
        loading={submitting}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
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
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  cta: { marginTop: spacing.md },
});
