import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { endAuthenticatedSession } from "@/lib/authenticated-state";
import { trackEvent } from "@/lib/analytics";
import { clearOnboardingDraft } from "@/lib/onboarding-draft";
import { getStoredUser } from "@/lib/session";
import { colors } from "@/components/onboarding/ui";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();

  async function onSignOut() {
    await endAuthenticatedSession();
    router.replace("/(auth)/login");
  }

  return (
    <Pressable style={styles.button} onPress={onSignOut}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

function compactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email.length > 12 ? `${email.slice(0, 11)}…` : email;
  return `${local.length > 10 ? `${local.slice(0, 10)}…` : local}@${domain}`;
}

export function OnboardingAccountSwitch({
  step,
}: {
  step: "location" | "school" | "age" | "class";
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    getStoredUser().then((user) => setEmail(user?.email ?? ""));
  }, []);

  function confirmSwitch() {
    Alert.alert(
      "Switch account?",
      "You'll return to sign in and can choose another Google, Apple, or email account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch account",
          onPress: async () => {
            trackEvent("onboarding_account_switch", { step });
            await clearOnboardingDraft();
            await endAuthenticatedSession();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }

  return (
    <Pressable
      style={styles.accountSwitch}
      onPress={confirmSwitch}
      accessibilityRole="button"
      accessibilityLabel={
        email ? `Signed in as ${email}. Switch account` : "Switch account"
      }
    >
      {email ? (
        <Text style={styles.accountText} numberOfLines={1}>
          Signed in as {compactEmail(email)} ·{" "}
          <Text style={styles.switchText}>Not you?</Text>
        </Text>
      ) : (
        <Text style={styles.switchText}>Not you? Switch account</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 12,
    minHeight: 44,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  text: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "600",
  },
  accountSwitch: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: {
    maxWidth: "100%",
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  switchText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
