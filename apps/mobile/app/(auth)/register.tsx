import { useCallback, useEffect, useState } from "react";
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
import { SocialAuthSection } from "@/components/SocialAuthSection";
import { AuthPitchStrip } from "@/components/AuthPitchStrip";
import { LegalFooter } from "@/components/LegalFooter";
import { VaaraLogo } from "@/components/VaaraLogo";
import { Button, InlineError } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { trackAuthConversion, trackEvent } from "@/lib/analytics";
import { routeAfterAuth } from "@/lib/auth-navigation";
import { saveSession } from "@/lib/session";
import { isGoogleSignInConfigured } from "@/constants/google-auth";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"parent" | "provider">("parent");
  const [displayName, setDisplayName] = useState("");
  const [showEmail, setShowEmail] = useState(
    Platform.OS !== "ios" && !isGoogleSignInConfigured()
  );
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("signup_view");
  }, []);

  const completeAuth = useCallback(
    async (
      result: Awaited<ReturnType<typeof api.register>>,
      method: "password" | "google" | "apple" = "password"
    ) => {
      trackEvent("signup_method_selected", { method });
      trackAuthConversion("sign_up", method);
      await saveSession(result.token, result.user);
      await routeAfterAuth(router, result.user);
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
              Parents from the same school, class and locality.
            </Text>
          </View>

          <SocialAuthSection
            onSuccess={(result, method) => completeAuth(result, method)}
            onError={setGoogleError}
            role={role}
            displayName={displayName}
            googleLabel="Continue with Google"
            appleButtonType="signUp"
          />

          {showEmail ? (
            <>
              <Text style={styles.label}>Your name (kept private)</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textSubtle}
                value={displayName}
                onChangeText={setDisplayName}
                testID="clarity-mask"
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
                testID="clarity-mask"
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
                testID="clarity-mask"
              />

              {displayError ? <InlineError message={displayError} /> : null}

              <Button
                label="Create account"
                onPress={onRegister}
                loading={loading}
                disabled={!email.trim() || password.length < 8}
                style={styles.button}
              />
            </>
          ) : (
            <>
              {displayError ? <InlineError message={displayError} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  trackEvent("signup_method_selected", { method: "email" });
                  setShowEmail(true);
                }}
                style={styles.emailToggle}
              >
                <Text style={styles.emailToggleText}>Use email instead</Text>
              </Pressable>
            </>
          )}

          <Link href="/(auth)/login" style={styles.link}>
            Already have an account? Log in
          </Link>

          {role === "parent" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("provider")}
              style={styles.providerLink}
            >
              <Text style={styles.providerLinkText}>
                I&apos;m a teacher or school
              </Text>
            </Pressable>
          ) : (
            <View style={styles.providerNote}>
              <Text style={styles.providerNoteText}>
                Signing up as a teacher or institution. You&apos;ll add your
                organisation next.
              </Text>
              <Pressable onPress={() => setRole("parent")}>
                <Text style={styles.providerLinkText}>Join as a parent instead</Text>
              </Pressable>
            </View>
          )}

          <AuthPitchStrip />
          <LegalFooter extra="Your real name stays private in circles." />
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
  },
  label: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
    marginBottom: 6,
  },
  emailToggle: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  emailToggleText: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
  providerLink: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  providerLinkText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
    textAlign: "center",
  },
  providerNote: {
    marginTop: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  providerNoteText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textAlign: "center",
  },
});
