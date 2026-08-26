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
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type Child } from "@/lib/api";
import { getToken } from "@/lib/session";

const EVENT_TYPES = ["exam", "ptm", "holiday", "fee_due", "event", "deadline"];

export default function NewSchoolEventScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("event");
  const [startsAt, setStartsAt] = useState("");
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
    if (!schoolId || !title.trim() || !startsAt.trim()) {
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
        startsAt: new Date(startsAt).toISOString(),
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
      <Text style={styles.hint}>
        Parent-reported events stay labelled unconfirmed until three parents
        confirm them.
      </Text>
      {children.length > 1 ? (
        <>
          <Text style={styles.label}>Child's school</Text>
          {children.map((child) => (
            <Pressable
              key={child.id}
              style={[
                styles.schoolChip,
                schoolId === child.schoolId && styles.schoolChipActive,
              ]}
              onPress={() => setSchoolId(child.schoolId)}
            >
              <Text
                style={[
                  styles.schoolChipText,
                  schoolId === child.schoolId && styles.schoolChipTextActive,
                ]}
              >
                {child.school.displayLabel}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Type</Text>
      <View style={styles.row}>
        {EVENT_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.chip, eventType === type && styles.chipActive]}
            onPress={() => setEventType(type)}
          >
            <Text
              style={[
                styles.chipText,
                eventType === type && styles.chipTextActive,
              ]}
            >
              {type}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Starts at (ISO or parseable date)</Text>
      <TextInput
        style={styles.input}
        value={startsAt}
        onChangeText={setStartsAt}
        placeholder="2026-03-15T09:00:00"
      />
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Pressable
        style={[styles.btn, submitting && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        <Text style={styles.btnText}>
          {submitting ? "Saving…" : "Report event"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  hint: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginTop: 12 },
  input: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  schoolChip: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  schoolChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  schoolChipText: { color: colors.text },
  schoolChipTextActive: { color: colors.primary, fontWeight: "600" },
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
