import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { VaaraLogo } from "@/components/VaaraLogo";
import { Button, InlineError } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <VaaraLogo />
          <View style={styles.heading}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to reconnect with your trusted parent community.
            </Text>
          </View>

          <GoogleAuthSection
            onSuccess={completeAuth}
            onError={setGoogleError}
          />

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor={colors.textSubtle}
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {displayError ? <InlineError message={displayError} /> : null}

          <Button
            label="Sign in with email"
            onPress={onLogin}
            loading={loading}
            disabled={!email.trim() || !password}
            style={styles.button}
          />

          <Link href="/(auth)/register" style={styles.link}>
            New to Vaara? Create an account
          </Link>
          <Text style={styles.privacy}>
            Your real name and child details stay private in circles.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  heading: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: {
    ...typography.display,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -1,
  },
  subtitle: {
    ...typography.body,
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  label: {
    ...typography.supporting,
    fontFamily: typography.semibold,
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    minHeight: 50,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
    fontFamily: typography.regular,
  },
  button: { marginTop: spacing.md },
  link: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: typography.semibold,
  },
  privacy: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
