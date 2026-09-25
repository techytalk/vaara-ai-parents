import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SocialAuthSection } from "@/components/SocialAuthSection";
import { AuthHookHeadline } from "@/components/AuthHookHeadline";
import {
  AuthScreenShell,
  useAuthDensityBand,
} from "@/components/AuthScreenShell";
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
import { beginAuthenticatedSession } from "@/lib/authenticated-state";
import { isGoogleSignInConfigured } from "@/constants/google-auth";
import {
  isValidEmail,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@vaara/shared/auth-input";

export default function LoginScreen() {
  const router = useRouter();
  const band = useAuthDensityBand();
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
      await beginAuthenticatedSession(result.token, result.user);
      await routeAfterAuth(router, result.user, {
        isNewUser: shouldRouteAsNewParent(result),
      });
    },
    [router]
  );

  async function onLogin() {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Enter a valid email address, like you@example.com");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }
    setLoading(true);
    try {
      const result = await api.login({ email: email.trim(), password });
      await completeAuth(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const displayError = error ?? googleError;

  return (
    <AuthScreenShell
      band={band}
      scrollBody={showEmail}
      body={
        <>
          <VaaraLogo compact />

          <AuthHookHeadline
            band={band}
            kicker="Welcome back"
            headline={[
              { text: "Your parent " },
              { text: "conversations", accent: true },
              { text: " are waiting." },
            ]}
            lead="Sign in to see what parents from your school, neighbourhood and class are talking about."
          />

          {!showEmail ? (
            <>
              <SocialAuthSection
                onSuccess={(result, method) => completeAuth(result, method)}
                onError={setGoogleError}
                googleLabel="Sign in with Google"
                appleButtonType="signIn"
              />
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
          ) : (
            <View style={styles.emailForm}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                maxLength={MAX_EMAIL_LENGTH}
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
                textContentType="password"
                secureTextEntry
                maxLength={MAX_PASSWORD_LENGTH}
                value={password}
                onChangeText={setPassword}
                testID="clarity-mask"
              />

              {displayError ? <InlineError message={displayError} /> : null}

              <Button
                label="Sign in with email"
                onPress={onLogin}
                loading={loading}
                disabled={!isValidEmail(email) || !password}
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
          )}
        </>
      }
      footer={
        <>
          <View style={styles.meta}>
            <Link href="/(auth)/register" asChild>
              <Pressable accessibilityRole="link" style={styles.loginRow}>
                <Text style={styles.loginMuted}>New to Vaara?</Text>
                <Text style={styles.loginAction}> Create an account →</Text>
              </Pressable>
            </Link>
          </View>
          <LegalFooter
            brief
            compact
            extra="Your real name stays private in circles."
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
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
    minHeight: 48,
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
    alignItems: "center",
  },
  emailButton: {
    minHeight: 48,
    marginTop: 4,
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
