import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type SchoolEvent } from "@/lib/api";
import { getToken } from "@/lib/session";

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    return <ScreenLoader label="Loading school calendar" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          label="Report an event"
          onPress={() => router.push("/(app)/calendar/new")}
        />
      </View>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={[
          styles.list,
          events.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No upcoming events"
            message="PTMs, exams, and holidays from your school community appear here. Parents can report events for others to confirm."
            actionLabel="Report an event"
            onAction={() => router.push("/(app)/calendar/new")}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              {item.unconfirmed ? (
                <View style={styles.unconfirmedBadge}>
                  <Text style={styles.unconfirmedText}>Unconfirmed</Text>
                </View>
              ) : (
                <View style={styles.confirmedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.teal}
                  />
                  <Text style={styles.confirmedText}>Confirmed</Text>
                </View>
              )}
              <Text style={styles.eventType}>{item.eventType}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{item.schoolName}</Text>
            <Text style={styles.time}>{formatEventTime(item.startsAt)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xs },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  unconfirmedBadge: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  unconfirmedText: {
    ...typography.caption,
    color: colors.coral,
    fontFamily: typography.bold,
    textTransform: "uppercase",
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confirmedText: {
    ...typography.caption,
    color: colors.teal,
    fontFamily: typography.semibold,
  },
  eventType: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    textTransform: "capitalize",
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: typography.regular,
  },
  time: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontFamily: typography.medium,
  },
});
