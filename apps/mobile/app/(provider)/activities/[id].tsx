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
import { api, type Activity } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinCodesText, setPinCodesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const list = await api.getProviderActivities(token);
        const found = list.find((a) => a.id === id);
        if (!found) {
          setError("Not found");
          return;
        }
        setActivity(found);
        setTitle(found.title);
        setDescription(found.description);
        setPinCodesText(found.pinCodes.join(", "));
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function onSave(status?: string) {
    const pins = pinCodesText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.updateProviderActivity(token, id, {
        title: title.trim(),
        description: description.trim(),
        pinCodes: pins,
        status: status ?? activity?.status,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert("Delete activity?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.deleteProviderActivity(token, id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.centered}>
        <Text>{error ?? "Activity not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.status}>Status: {activity.status}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        value={pinCodesText}
        onChangeText={setPinCodesText}
        placeholder="Pin codes"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={() => onSave()} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save changes</Text>
        )}
      </Pressable>

      {activity.status !== "published" && (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => onSave("published")}
          disabled={saving}
        >
          <Text style={styles.secondaryBtnText}>Publish</Text>
        </Pressable>
      )}

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>Delete activity</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  status: { fontSize: 13, color: "#5c5c7a", marginBottom: 12 },
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
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#4f46e5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#4f46e5", fontWeight: "600" },
  deleteBtn: { marginTop: 16, alignItems: "center", padding: 12 },
  deleteBtnText: { color: "#dc2626", fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 8 },
});
