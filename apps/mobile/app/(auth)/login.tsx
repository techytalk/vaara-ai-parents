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
import { Ionicons } from "@expo/vector-icons";
import { SocialAuthSection } from "@/components/SocialAuthSection";
import { AuthPitchStrip } from "@/components/AuthPitchStrip";
import { LegalFooter } from "@/components/LegalFooter";
import { VaaraLogo } from "@/components/VaaraLogo";
import { Button, InlineError } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { trackAuthConversion } from "@/lib/analytics";
import {
  routeAfterAuth,
  shouldRouteAsNewParent,
} from "@/lib/auth-navigation";
import { saveSession } from "@/lib/session";
import { isGoogleSignInConfigured } from "@/constants/google-auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmail, setShowEmail] = useState(
    Platform.OS !== "ios" && !isGoogleSignInConfigured()
  );
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completeAuth = useCallback(
    async (
      result: Awaited<ReturnType<typeof api.login>>,
      method: "password" | "google" | "apple" = "password"
    ) => {
      trackAuthConversion("login", method);
      await saveSession(result.token, result.user);
      await routeAfterAuth(router, result.user, {
        isNewUser: shouldRouteAsNewParent(result),
      });
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
            <Text style={styles.kicker}>Welcome back</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.lead}>
              Use the same method you used to create your account.
            </Text>
          </View>

          <SocialAuthSection
            onSuccess={(result, method) => completeAuth(result, method)}
            onError={setGoogleError}
            googleLabel="Sign in with Google"
            appleButtonType="signIn"
          />

          {showEmail ? (
            <View style={styles.emailForm}>
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
                placeholder="Your password"
                placeholderTextColor={colors.textSubtle}
                autoComplete="current-password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                testID="clarity-mask"
              />

              {displayError ? <InlineError message={displayError} /> : null}

              <Button
                label="Sign in with email"
                onPress={onLogin}
                loading={loading}
                disabled={!email.trim() || !password}
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
                onPress={() => setShowEmail(true)}
                style={styles.emailButton}
              >
                <Ionicons name="mail-outline" size={18} color={colors.text} />
                <Text style={styles.emailButtonText}>Sign in with email</Text>
              </Pressable>
            </>
          )}

          <View style={styles.meta}>
            <Link href="/(auth)/register" asChild>
              <Pressable accessibilityRole="link" style={styles.loginRow}>
                <Text style={styles.loginMuted}>New to Vaara?</Text>
                <Text style={styles.loginAction}> Create an account</Text>
              </Pressable>
            </Link>
          </View>

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
  button: { marginTop: spacing.sm },
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
    minHeight: 40,
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
});
