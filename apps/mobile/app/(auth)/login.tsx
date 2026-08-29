import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { api } from "@/lib/api";
import { routeAfterAuth } from "@/lib/auth-navigation";
import { saveSession } from "@/lib/session";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completeAuth = useCallback(
    async (result: Awaited<ReturnType<typeof api.login>>) => {
      await saveSession(result.token, result.user);
      routeAfterAuth(router, result.user);
    },
    [router]
  );

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await api.login({ email, password });
      await completeAuth(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const displayError = error ?? googleError;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Connect with parents in your community</Text>

      <GoogleAuthSection
        onSuccess={completeAuth}
        onError={setGoogleError}
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
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={onLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with email</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" style={styles.link}>
        Create an account
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
    marginBottom: 24,
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
});
