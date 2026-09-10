import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, InlineError } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { clearSession, getToken } from "@/lib/session";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Please sign in again, then try deleting your account.");
        return;
      }
      await api.deleteAccount(token);
      await clearSession();
      router.replace("/(auth)/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not delete your account. Please try again or email support@vaara.ai."
      );
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently removes your Vaara Parents account, child profiles, posts, messages, and uploaded media. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delete your account</Text>
      <Text style={styles.body}>
        Deleting your account removes personal data tied to it from Vaara
        Parents, including:
      </Text>
      <View style={styles.card}>
        {[
          "Account, email, and sign-in details",
          "Child profiles you added",
          "Location and optional contact details",
          "Circle posts, comments, and marketplace listings",
          "Messages, connection requests, and uploaded photos or files",
        ].map((item) => (
          <Text key={item} style={styles.bullet}>
            {`\u2022  ${item}`}
          </Text>
        ))}
      </View>
      <Text style={styles.body}>
        Limited safety records (for example reports) may be kept in anonymized
        form where needed to investigate abuse or comply with law. Encrypted
        backups may retain deleted data for up to 30 days.
      </Text>
      {error ? <InlineError message={error} /> : null}
      <Button
        label="Delete my account"
        variant="coral"
        onPress={confirmDelete}
        loading={loading}
        style={styles.button}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.sectionTitle,
    fontFamily: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  bullet: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.regular,
  },
  button: { marginTop: spacing.sm },
});
