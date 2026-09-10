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
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VaaraLogo compact />

          <View style={styles.heading}>
            <Text style={styles.kicker}>
              {role === "parent" ? "New to Vaara" : "For schools & trainers"}
            </Text>
            <Text style={styles.title}>
              {role === "parent"
                ? "Create your parent account"
                : "Create your school, trainer or institution account"}
            </Text>
            <Text style={styles.lead}>
              {role === "parent"
                ? "Free for parents. Join circles from your child’s school, class and locality."
                : "For teachers, schools, trainers and institutions. You’ll add your organisation after sign-up."}
            </Text>
          </View>

          <SocialAuthSection
            onSuccess={(result, method) => completeAuth(result, method)}
            onError={setGoogleError}
            role={role}
            displayName={displayName}
            googleLabel="Sign up with Google"
            appleButtonType="signUp"
          />

          {showEmail ? (
            <View style={styles.emailForm}>
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

              <Pressable
                accessibilityRole="button"
                onPress={() => setShowEmail(false)}
                style={styles.quietLink}
              >
                <Text style={styles.quietLinkText}>
                  Use Apple or Google instead
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {displayError ? <InlineError message={displayError} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  trackEvent("signup_method_selected", { method: "email" });
                  setShowEmail(true);
                }}
                style={styles.emailButton}
              >
                <Ionicons name="mail-outline" size={18} color={colors.text} />
                <Text style={styles.emailButtonText}>Sign up with email</Text>
              </Pressable>
            </>
          )}

          <View style={styles.meta}>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" style={styles.loginRow}>
                <Text style={styles.loginMuted}>Already have an account?</Text>
                <Text style={styles.loginAction}> Sign in</Text>
              </Pressable>
            </Link>
          </View>

          {role === "parent" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("provider")}
              style={styles.providerRow}
            >
              <Ionicons name="school-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.providerRowText}>
                I&apos;m a teacher, school or trainer
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("parent")}
              style={styles.providerRow}
            >
              <Ionicons name="people-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.providerRowText}>
                I&apos;m a parent
              </Text>
            </Pressable>          )}

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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  kicker: {
    ...typography.caption,
    fontFamily: typography.bold,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    ...typography.display,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -0.8,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  emailForm: {
    marginTop: spacing.xs,
  },
  label: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
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
  button: { marginTop: spacing.sm },
  meta: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  emailButton: {
    minHeight: 50,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  emailButtonText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.semibold,
  },
  quietLink: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  quietLinkText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  loginMuted: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  loginAction: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  providerRow: {
    marginTop: spacing.lg,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  providerRowText: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
  providerNote: {
    marginTop: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  providerNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  providerNoteTitle: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textAlign: "center",
  },
  providerNoteText: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.regular,
    textAlign: "center",
  },
  providerSwitchHit: {
    minHeight: 40,
    justifyContent: "center",
  },
  providerSwitch: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textAlign: "center",
  },
});
