import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/session";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"parent" | "provider">("parent");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.register({
        email,
        password,
        role,
        displayName: displayName.trim() || undefined,
      });
      await saveSession(token, user);
      if (user.onboardingComplete) {
        router.replace(user.role === "provider" ? "/(provider)" : "/(app)");
      } else if (user.role === "provider") {
        router.replace("/onboarding/provider");
      } else {
        router.replace("/onboarding/children");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Vaara Parents</Text>
      <Text style={styles.subtitle}>
        {role === "parent"
          ? "Your name stays private — you'll get an anonymous handle in circles"
          : "Share classes and workshops with parents in your service areas"}
      </Text>

      <Text style={styles.label}>I am a</Text>
      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleChip, role === "parent" && styles.roleChipActive]}
          onPress={() => setRole("parent")}
        >
          <Text
            style={[
              styles.roleChipText,
              role === "parent" && styles.roleChipTextActive,
            ]}
          >
            Parent
          </Text>
        </Pressable>
        <Pressable
          style={[styles.roleChip, role === "provider" && styles.roleChipActive]}
          onPress={() => setRole("provider")}
        >
          <Text
            style={[
              styles.roleChipText,
              role === "provider" && styles.roleChipTextActive,
            ]}
          >
            Teacher / Institution
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Your name (private)"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create account</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f8f9fc",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: "#5c5c7a",
    marginTop: 8,
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    marginBottom: 8,
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#4f46e5",
    fontSize: 15,
  },
  label: { fontSize: 13, color: "#5c5c7a", marginBottom: 8 },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  roleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e4ef",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  roleChipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  roleChipText: { fontSize: 14, color: "#1a1a2e", fontWeight: "600" },
  roleChipTextActive: { color: "#fff" },
});
