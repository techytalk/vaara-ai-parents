import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type AuthUser, type ProviderProfile } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ProviderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }
      try {
        const me = await api.me(token);
        if (!me.onboardingComplete) {
          router.replace("/onboarding/provider");
          return;
        }
        const [prof, activities] = await Promise.all([
          api.getProviderProfile(token),
          api.getProviderActivities(token),
        ]);
        setUser(me);
        setProfile(prof);
        setActivityCount(activities.length);
      } catch {
        router.replace("/(auth)/login");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile?.orgName ?? "Your organization"}</Text>
      <Text style={styles.sub}>{profile?.providerType}</Text>
      <Text style={styles.meta}>
        Serving pin codes: {profile?.servicePinCodes?.join(", ")}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{activityCount} activities</Text>
        <Text style={styles.cardBody}>
          Publish workshops, classes, and camps for parents in your service areas.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/(provider)/activities/new")}
        >
          <Text style={styles.buttonText}>Create activity</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", color: "#1a1a2e" },
  sub: { fontSize: 15, color: "#5c5c7a", marginTop: 4, textTransform: "capitalize" },
  meta: { fontSize: 14, color: "#5c5c7a", marginTop: 8 },
  card: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1a1a2e" },
  cardBody: { fontSize: 14, color: "#5c5c7a", marginTop: 8, lineHeight: 20 },
  button: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
