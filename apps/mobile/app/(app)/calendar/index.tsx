import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type SchoolEvent } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function CalendarScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setEvents(await api.getUpcomingSchoolEvents(token));
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.addBtn}
        onPress={() => router.push("/(app)/calendar/new")}
      >
        <Text style={styles.addBtnText}>Report an event</Text>
      </Pressable>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={
          events.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No upcoming school events in the next week. Parents can report PTMs,
            exams, and holidays once they appear.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.unconfirmed ? (
              <Text style={styles.unconfirmed}>Unconfirmed</Text>
            ) : null}
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.schoolName} · {item.eventType} ·{" "}
              {new Date(item.startsAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  addBtn: {
    margin: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: colors.textMuted, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unconfirmed: {
    fontSize: 11,
    fontWeight: "700",
    color: "#c2410c",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
});
