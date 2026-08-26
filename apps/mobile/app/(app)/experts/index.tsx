import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type ExpertSession } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ExpertSessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ExpertSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      setSessions(await api.getExpertSessions(token));
      setLoading(false);
    });
  }, []);

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
      data={sessions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={sessions.length ? styles.list : styles.emptyContainer}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No expert sessions scheduled yet. Closed sessions stay searchable once
          added.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: "/(app)/experts/[id]",
              params: { id: item.id, title: item.title },
            })
          }
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.expert.displayName} · {item.expert.credentials}
            {item.expert.verified ? " · Verified" : ""}
          </Text>
          <Text style={styles.date}>
            {new Date(item.startsAt).toLocaleString()}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
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
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  date: { fontSize: 12, color: colors.primary, marginTop: 4 },
});
