import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type AuthUser } from "@/lib/api";
import { clearSession, getToken } from "@/lib/session";

export default function ProviderProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setUser(await api.me(token));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onSignOut() {
    await clearSession();
    router.replace("/(auth)/login");
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Account</Text>
      <Text style={styles.value}>{user?.email}</Text>
      <Text style={styles.label}>Role</Text>
      <Text style={styles.valueMuted}>Provider</Text>

      <Pressable style={styles.button} onPress={onSignOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f8f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 13, color: "#5c5c7a", marginTop: 16, marginBottom: 4 },
  value: { fontSize: 16, color: "#1a1a2e" },
  valueMuted: { fontSize: 16, color: "#1a1a2e" },
  button: {
    marginTop: 40,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#dc2626", fontWeight: "600", fontSize: 16 },
});
