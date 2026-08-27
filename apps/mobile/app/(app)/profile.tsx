import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SignOutButton } from "@/components/SignOutButton";
import { FEATURE_FLAGS } from "@/constants/features";
import { colors } from "@/constants/theme";
import {
  api,
  type AuthUser,
  type NotificationPrefs,
} from "@/lib/api";
import { getToken } from "@/lib/session";

type BooleanPrefKey = Exclude<keyof NotificationPrefs, "quiet_hours">;

const PREF_LABELS: Record<BooleanPrefKey, string> = {
  circle_posts: "Circle posts",
  circle_replies: "Replies to your posts",
  direct_messages: "Direct messages",
  reminders: "Reminders",
  activity_nearby: "Nearby activities",
  topics: "Topic digests",
  listings: "Marketplace",
  disclosures: "Identity sharing",
  carpool: "Carpool updates",
  school_events: "School calendar",
  expert_sessions: "Expert sessions",
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me(token);
        setUser(me);
        setPrefs(await api.getNotificationPrefs(token));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function togglePref(key: BooleanPrefKey, value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(prefs);
    }
  }

  async function toggleQuietHours(value: boolean) {
    const token = await getToken();
    if (!token || !prefs) return;
    const updated = {
      ...prefs,
      quiet_hours: {
        ...prefs.quiet_hours,
        enabled: value,
      },
    };
    setPrefs(updated);
    try {
      await api.updateNotificationPrefs(token, updated);
    } catch {
      setPrefs(prefs);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.label}>Anonymous handle</Text>
      <Text style={styles.value}>{user?.anonymousHandle}</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.valueMuted}>{user?.email}</Text>

      <Text style={styles.sectionTitle}>Family & circles</Text>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/onboarding/children")}
      >
        <Text style={styles.linkText}>Children & schools</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/onboarding/location")}
      >
        <Text style={styles.linkText}>Location & community</Text>
      </Pressable>

      {FEATURE_FLAGS.showDoctors ? (
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push("/(app)/practitioners")}
        >
          <Text style={styles.linkText}>Local doctor recommendations</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/experts")}
      >
        <Text style={styles.linkText}>Expert Q&A sessions</Text>
      </Pressable>
      {FEATURE_FLAGS.showPlaydates ? (
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push("/(app)/playdates")}
        >
          <Text style={styles.linkText}>Playdates (opt-in)</Text>
        </Pressable>
      ) : null}
      {FEATURE_FLAGS.showCarpool ? (
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push("/(app)/carpool")}
        >
          <Text style={styles.linkText}>School carpool</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/schools")}
      >
        <Text style={styles.linkText}>Browse schools</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/topics")}
      >
        <Text style={styles.linkText}>Interest topics</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/calendar")}
      >
        <Text style={styles.linkText}>School calendar</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/contact-details")}
      >
        <Text style={styles.linkText}>Contact details for handover</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/saved")}
      >
        <Text style={styles.linkText}>Saved posts</Text>
      </Pressable>
      <Pressable
        style={styles.linkRow}
        onPress={() => router.push("/(app)/reminders")}
      >
        <Text style={styles.linkText}>My reminders</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Notification preferences</Text>
      <Text style={styles.sectionHint}>
        Circle and topic activity arrives as a digest. Replies and messages are immediate.
      </Text>

      {prefs && (
        <>
          {(Object.keys(PREF_LABELS) as BooleanPrefKey[]).map((key) => (
            <View key={key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{PREF_LABELS[key]}</Text>
              <Switch
                value={prefs[key] !== false}
                onValueChange={(value) => togglePref(key, value)}
              />
            </View>
          ))}
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefLabel}>Quiet hours</Text>
              <Text style={styles.prefHint}>
                {prefs.quiet_hours?.start ?? "22:00"} – {prefs.quiet_hours?.end ?? "07:00"}
              </Text>
            </View>
            <Switch
              value={prefs.quiet_hours?.enabled !== false}
              onValueChange={toggleQuietHours}
            />
          </View>
        </>
      )}

      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 16,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.primary,
  },
  valueMuted: {
    fontSize: 16,
    color: colors.text,
  },
  linkRow: {
    marginTop: 24,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  prefCopy: {
    flex: 1,
    paddingRight: 12,
  },
  prefLabel: { fontSize: 15, color: colors.text },
  prefHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
