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

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
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

      {prefs && (
        <>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Circle posts</Text>
            <Switch
              value={prefs.circle_posts !== false}
              onValueChange={(v) => togglePref("circle_posts", v)}
            />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Direct messages</Text>
            <Switch
              value={prefs.direct_messages !== false}
              onValueChange={(v) => togglePref("direct_messages", v)}
            />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Reminders</Text>
            <Switch
              value={prefs.reminders !== false}
              onValueChange={(v) => togglePref("reminders", v)}
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
  prefLabel: { fontSize: 15, color: colors.text },
});
