import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, ScreenLoader } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { api, type AuthUser } from "@/lib/api";
import { clearSession, getToken } from "@/lib/session";

export default function ProviderProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setUser(await api.me(token));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onSignOut() {
    await clearSession();
    router.replace("/(auth)/login");
  }

  if (loading) {
    return <ScreenLoader label="Loading profile" />;
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.label}>Account email</Text>
        <Text style={styles.value}>{user?.email}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.valueMuted}>Provider</Text>
      </Card>

      <Button label="Sign out" variant="secondary" onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  card: { gap: spacing.xs },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  valueMuted: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    textTransform: "capitalize",
  },
});
