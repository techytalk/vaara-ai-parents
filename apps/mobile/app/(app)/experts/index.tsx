import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type ExpertSession } from "@/lib/api";
import { getToken } from "@/lib/session";

function formatSessionTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    return <ScreenLoader label="Loading expert sessions" />;
  }

  return (
    <FlatList
      style={styles.container}
      data={sessions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        sessions.length ? styles.list : styles.listEmpty
      }
      ListEmptyComponent={
        <EmptyState
          icon="school-outline"
          title="No expert sessions"
          message="Closed Q&A sessions with verified experts appear here. You'll get an immediate alert when a new session opens."
        />
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
          <View style={styles.expertRow}>
            <Text style={styles.expertName}>{item.expert.displayName}</Text>
            {item.expert.verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.credentials}>{item.expert.credentials}</Text>
          <Text style={styles.date}>{formatSessionTime(item.startsAt)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.xs },
  listEmpty: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.bold,
  },
  expertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  expertName: {
    ...typography.supporting,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.teal,
    fontFamily: typography.semibold,
  },
  credentials: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.regular,
  },
  date: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontFamily: typography.medium,
  },
});
