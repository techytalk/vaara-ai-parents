import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isGoogleSignInConfigured } from "@/constants/google-auth";

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
        <ActivityIndicator color="#1a1a2e" />
      ) : (
        <View style={styles.content}>
          <Ionicons name="logo-google" size={18} color="#1a1a2e" />
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
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
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e4ef",
  },
  dividerText: {
    color: "#5c5c7a",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
