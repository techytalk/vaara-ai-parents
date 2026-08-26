import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { clearSession } from "@/lib/session";
import { colors } from "@/components/onboarding/ui";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();

  async function onSignOut() {
    await clearSession();
    router.replace("/(auth)/login");
  }

  return (
    <Pressable style={styles.button} onPress={onSignOut}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  text: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
});
