import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"parent" | "provider">("parent");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completeAuth = useCallback(
    async (result: Awaited<ReturnType<typeof api.register>>) => {
      await saveSession(result.token, result.user);
      routeAfterAuth(router, result.user);
    },
    [router]
  );

  async function onRegister() {
    setError(null);
    setLoading(true);
    try {
      const result = await api.register({
        email,
        password,
        role,
        displayName: displayName.trim() || undefined,
      });
      await completeAuth(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
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
          <VaaraLogo compact />
          <View style={styles.heading}>
            <Text style={styles.title}>Join Vaara</Text>
            <Text style={styles.subtitle}>
              {role === "parent"
                ? "Your real name stays private. Parents see only your anonymous handle."
                : "Share classes and workshops with parents in the areas you serve."}
            </Text>
          </View>

          <Text style={styles.label}>I am joining as</Text>
          <View style={styles.roleRow}>
            {(["parent", "provider"] as const).map((value) => {
              const selected = role === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.roleChip,
                    selected && styles.roleChipActive,
                  ]}
                  onPress={() => setRole(value)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selected && styles.roleChipTextActive,
                    ]}
                  >
                    {value === "parent" ? "Parent" : "Teacher / Institution"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <GoogleAuthSection
            onSuccess={completeAuth}
            onError={setGoogleError}
            role={role}
            displayName={displayName}
            label="Sign up with Google"
          />

          <Text style={styles.label}>Your name (kept private)</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textSubtle}
            value={displayName}
            onChangeText={setDisplayName}
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
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textSubtle}
            autoComplete="new-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {displayError ? <InlineError message={displayError} /> : null}

          <Button
            label="Create account"
            onPress={onRegister}
            loading={loading}
            disabled={!email.trim() || password.length < 8}
            style={styles.button}
          />

          <Link href="/(auth)/login" style={styles.link}>
            Already have an account? Sign in
          </Link>
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
  heading: { marginTop: spacing.xl, marginBottom: spacing.lg },
  title: {
    ...typography.display,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
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
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
    marginBottom: 6,
  },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  roleChip: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  roleChipTextActive: { color: colors.textInverse },
});
