import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Reminder } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setReminders(await api.getReminders(token));
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

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
    return <ScreenLoader label="Loading reminders" />;
  }

  return (
    <FlatList
      style={styles.container}
      data={reminders}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
      contentContainerStyle={
        reminders.length === 0 ? styles.emptyContainer : styles.list
      }
      ListHeaderComponent={
        <Text style={styles.hint}>
          Reminders you set from activities arrive as immediate alerts at the
          scheduled time.
        </Text>
      }
      ListEmptyComponent={
        <EmptyState
          icon="alarm-outline"
          title="No reminders yet"
          message="Open an activity and set a reminder when you want a nudge before it starts."
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={item.sent ? "checkmark-circle" : "alarm-outline"}
              size={20}
              color={item.sent ? colors.teal : colors.amber}
            />
          </View>
          <View style={styles.main}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.time}>
              {new Date(item.fireAt).toLocaleString()}
              {item.sent ? " · sent" : " · scheduled"}
            </Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
          {!item.sent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete reminder ${item.title}`}
              hitSlop={8}
              onPress={() => confirmDelete(item.id)}
            >
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  hint: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1 },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  time: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  note: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  delete: {
    ...typography.body,
    color: colors.error,
    fontFamily: typography.semibold,
  },
});
