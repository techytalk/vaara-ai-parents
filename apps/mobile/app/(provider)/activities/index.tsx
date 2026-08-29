import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Activity } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ProviderActivitiesList() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await api.getProviderActivities(token);
    setActivities(list);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <ScreenLoader label="Loading activities" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          label="New activity"
          icon="add"
          onPress={() => router.push("/(provider)/activities/new")}
        />
      </View>

      <FlatList
        data={activities}
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
          activities.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No activities yet"
            message="Create your first class, camp, or workshop for nearby parents."
            actionLabel="Create activity"
            onAction={() => router.push("/(provider)/activities/new")}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              router.push({
                pathname: "/(provider)/activities/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.status}>{item.status}</Text>
            <Text style={styles.meta}>Pins: {item.pinCodes.join(", ")}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  title: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  status: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: typography.semibold,
    marginTop: 4,
    textTransform: "capitalize",
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 6,
  },
});
