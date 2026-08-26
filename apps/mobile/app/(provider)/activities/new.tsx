import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Curriculum } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function NewActivityScreen() {
  const router = useRouter();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [pinCodesText, setPinCodesText] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [selectedCurricula, setSelectedCurricula] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCurricula().then(setCurricula).catch(() => {});
    getToken().then(async (token) => {
      if (!token) return;
      const profile = await api.getProviderProfile(token);
      if (profile?.servicePinCodes?.length) {
        setPinCodesText(profile.servicePinCodes.join(", "));
      }
    });
  }, []);

  function toggleCurriculum(id: string) {
    setSelectedCurricula((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function onSave() {
    const pins = pinCodesText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!title.trim() || !description.trim() || pins.length === 0) {
      setError("Title, description, and pin codes are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.createProviderActivity(token, {
        title: title.trim(),
        description: description.trim(),
        locationText: locationText.trim() || undefined,
        pinCodes: pins,
        curriculumIds: selectedCurricula,
        feeAmount: feeAmount ? Number(feeAmount) : undefined,
        startsAt: startsAt.trim() || undefined,
        status: publish ? "published" : "draft",
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Description"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        placeholder="Location (e.g. near metro, sector 2)"
        value={locationText}
        onChangeText={setLocationText}
      />
      <TextInput
        style={styles.input}
        placeholder="Pin codes (comma separated)"
        value={pinCodesText}
        onChangeText={setPinCodesText}
      />
      <TextInput
        style={styles.input}
        placeholder="Fee amount (INR, optional)"
        keyboardType="decimal-pad"
        value={feeAmount}
        onChangeText={setFeeAmount}
      />
      <TextInput
        style={styles.input}
        placeholder="Starts at (ISO date optional)"
        value={startsAt}
        onChangeText={setStartsAt}
      />

      <Text style={styles.label}>Target curricula (optional — empty = all)</Text>
      <View style={styles.chipRow}>
        {curricula.map((c) => (
          <Pressable
            key={c.id}
            style={[
              styles.chip,
              selectedCurricula.includes(c.id) && styles.chipActive,
            ]}
            onPress={() => toggleCurriculum(c.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCurricula.includes(c.id) && styles.chipTextActive,
              ]}
            >
              {c.code}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.toggle}
        onPress={() => setPublish((p) => !p)}
      >
        <Text style={styles.toggleText}>
          {publish ? "✓ Publish immediately" : "Save as draft"}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save activity</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  content: { padding: 16 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 120 },
  label: { fontSize: 13, color: "#5c5c7a", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e4ef",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 13, color: "#1a1a2e" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  toggle: { marginBottom: 12 },
  toggleText: { fontSize: 15, color: "#4f46e5", fontWeight: "600" },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#dc2626", marginBottom: 8 },
});
