import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, type Reminder } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setReminders(await api.getReminders(token));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onDelete(id: string) {
    const token = await getToken();
    if (!token) return;
    await api.deleteReminder(token, id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete reminder?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(id) },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={reminders}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No reminders. Set one from an activity detail screen.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.main}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.time}>
              {new Date(item.fireAt).toLocaleString()}
              {item.sent ? " · sent" : ""}
            </Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
          {!item.sent && (
            <Pressable onPress={() => confirmDelete(item.id)}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#5c5c7a", padding: 24, lineHeight: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  main: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  time: { fontSize: 13, color: "#5c5c7a", marginTop: 4 },
  note: { fontSize: 13, color: "#5c5c7a", marginTop: 4 },
  delete: { color: "#dc2626", fontWeight: "600" },
});
