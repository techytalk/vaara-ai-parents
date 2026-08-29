import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isGoogleSignInConfigured } from "@/constants/google-auth";
import { colors, radii, spacing, typography } from "@/constants/theme";

type GoogleSignInButtonProps = {
  onPress: () => void;
  loading?: boolean;
  label?: string;
};

export function GoogleSignInButton({
  onPress,
  loading = false,
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  if (!isGoogleSignInConfigured()) {
    return null;
  }

  return (
    <Pressable
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AuthDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.semibold,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: typography.semibold,
    textTransform: "uppercase",
  },
});
