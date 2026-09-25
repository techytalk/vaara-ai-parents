import { useCallback, useEffect, useState } from "react";
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
import { trackAuthConversion, trackEvent } from "@/lib/analytics";
import {
  routeAfterAuth,
  shouldRouteAsNewParent,
} from "@/lib/auth-navigation";
import { beginAuthenticatedSession } from "@/lib/authenticated-state";
import { isGoogleSignInConfigured } from "@/constants/google-auth";
import {
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  passwordError,
} from "@vaara/shared/auth-input";

export default function RegisterScreen() {
  const router = useRouter();
  const band = useAuthDensityBand();
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
      await beginAuthenticatedSession(result.token, result.user);
      await routeAfterAuth(router, result.user, {
        isNewUser: shouldRouteAsNewParent(result),
      });
    },
    [router]
  );

  async function onRegister() {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Enter a valid email address, like you@example.com");
      return;
    }
    const passwordProblem = passwordError(password);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    setLoading(true);
    try {
      const result = await api.register({
        email: email.trim(),
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

  const canRegister =
    isValidEmail(email) &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH;

  const displayError = error ?? googleError;
  const parentHeadline =
    band === "short"
      ? [
          { text: "Find parents from your child’s " },
          { text: "school", accent: true },
          { text: " and " },
          { text: "neighbourhood", accent: true },
          { text: "." },
        ]
      : [
          { text: "Find other parents from your child’s " },
          { text: "school", accent: true },
          { text: " and " },
          { text: "neighbourhood", accent: true },
          { text: ", and get real opinions and experiences." },
        ];

  return (
    <AuthScreenShell
      band={band}
      scrollBody={showEmail}
      body={
        <>
          <VaaraLogo compact />

          {role === "parent" ? (
            <AuthHookHeadline
              band={band}
              kicker="Create your Vaara account"
              headline={parentHeadline}
            />
          ) : (
            <AuthHookHeadline
              band={band}
              kicker="For schools & trainers"
              headline={[
                {
                  text:
                    band === "short"
                      ? "Create your school or trainer account"
                      : "Create your school, trainer or institution account",
                },
              ]}
              lead="For teachers, schools, trainers and institutions. You’ll add your organisation after sign-up."
            />
          )}

          <LegalFooter
            compact
            extra="Your real name stays private in circles."
          />

          {!showEmail ? (
            <>
              <SocialAuthSection
                onSuccess={(result, method) => completeAuth(result, method)}
                onError={setGoogleError}
                role={role}
                displayName={displayName}
                googleLabel="Continue with Google"
                appleButtonType="signUp"
              />
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
                <Text style={styles.emailButtonText}>Continue with email</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.emailForm}>
              <Text style={styles.label}>Your name (kept private)</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textSubtle}
                autoComplete="name"
                textContentType="name"
                maxLength={MAX_DISPLAY_NAME_LENGTH}
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
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                placeholderTextColor={colors.textSubtle}
                autoComplete="new-password"
                textContentType="newPassword"
                secureTextEntry
                maxLength={MAX_PASSWORD_LENGTH}
                value={password}
                onChangeText={setPassword}
                testID="clarity-mask"
              />

              {displayError ? <InlineError message={displayError} /> : null}

              <Button
                label="Create account"
                onPress={onRegister}
                loading={loading}
                disabled={!canRegister}
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
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" style={styles.loginRow}>
                <Text style={styles.loginMuted}>Already have an account?</Text>
                <Text style={styles.loginAction}> Sign in →</Text>
              </Pressable>
            </Link>
          </View>

          {role === "parent" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("provider")}
              style={band === "short" ? styles.providerLink : styles.providerRow}
            >
              {band !== "short" ? (
                <Ionicons
                  name="school-outline"
                  size={18}
                  color={colors.primaryDark}
                />
              ) : null}
              <Text
                style={
                  band === "short"
                    ? styles.providerLinkText
                    : styles.providerRowText
                }
              >
                I&apos;m a teacher, school or trainer
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("parent")}
              style={band === "short" ? styles.providerLink : styles.providerRow}
            >
              {band !== "short" ? (
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={colors.primaryDark}
                />
              ) : null}
              <Text
                style={
                  band === "short"
                    ? styles.providerLinkText
                    : styles.providerRowText
                }
              >
                I&apos;m a parent
              </Text>
            </Pressable>
          )}
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
    color: colors.text,
    fontFamily: typography.semibold,
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
  button: { marginTop: spacing.sm },
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
  providerRow: {
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
  providerLink: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  providerLinkText: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
});
