import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, type Activity } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setActivity(await api.getActivity(token, id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    });
  }, [id]);

  async function setReminder(label: string, fireAt: Date) {
    if (fireAt <= new Date()) {
      Alert.alert("Cannot set reminder in the past");
      return;
    }
    setSavingReminder(true);
    try {
      const token = await getToken();
      if (!token || !activity) return;
      await api.createReminder(token, {
        title: `Reminder: ${activity.title}`,
        note: label,
        fireAt: fireAt.toISOString(),
        activityId: activity.id,
      });
      Alert.alert("Reminder set", fireAt.toLocaleString());
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingReminder(false);
    }
  }

  function onRemind1Hour() {
    if (!activity) return;
    const base = activity.startsAt
      ? new Date(activity.startsAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fireAt = activity.startsAt
      ? new Date(base.getTime() - 60 * 60 * 1000)
      : base;
    setReminder("1 hour before", fireAt);
  }

  function onRemind1Day() {
    if (!activity) return;
    const base = activity.startsAt
      ? new Date(activity.startsAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fireAt = activity.startsAt
      ? new Date(base.getTime() - 24 * 60 * 60 * 1000)
      : base;
    setReminder("1 day before", fireAt);
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
        <Text>{error ?? "Not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.org}>{activity.provider?.orgName}</Text>
      <Text style={styles.type}>{activity.provider?.providerType}</Text>
      <Text style={styles.title}>{activity.title}</Text>

      {activity.feeAmount != null && (
        <Text style={styles.fee}>
          ₹{activity.feeAmount} {activity.feeCurrency}
        </Text>
      )}

      {activity.startsAt && (
        <Text style={styles.meta}>
          Starts: {new Date(activity.startsAt).toLocaleString()}
        </Text>
      )}

      {activity.locationText && (
        <Text style={styles.meta}>Location: {activity.locationText}</Text>
      )}

      <Text style={styles.meta}>Pin codes: {activity.pinCodes.join(", ")}</Text>

      <Text style={styles.section}>Reminders</Text>
      <View style={styles.reminderRow}>
        <Pressable
          style={styles.reminderBtn}
          onPress={onRemind1Day}
          disabled={savingReminder}
        >
          <Text style={styles.reminderBtnText}>1 day before</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={onRemind1Hour}
          disabled={savingReminder}
        >
          <Text style={styles.reminderBtnText}>1 hour before</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>About</Text>
      <Text style={styles.body}>{activity.description}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fc" },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  org: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  type: {
    fontSize: 13,
    color: "#5c5c7a",
    marginTop: 2,
    textTransform: "capitalize",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginTop: 8 },
  fee: { fontSize: 16, color: "#1a1a2e", marginTop: 10 },
  meta: { fontSize: 14, color: "#5c5c7a", marginTop: 6 },
  section: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
    marginTop: 24,
    marginBottom: 8,
  },
  reminderRow: { flexDirection: "row", gap: 8 },
  reminderBtn: {
    flex: 1,
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  reminderBtnText: { color: "#4f46e5", fontWeight: "600", fontSize: 13 },
  body: { fontSize: 15, color: "#1a1a2e", lineHeight: 24 },
});
