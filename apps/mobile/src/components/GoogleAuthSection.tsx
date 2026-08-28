import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { api } from "@/lib/api";

type GoogleAuthSectionProps = {
  onSuccess: (result: Awaited<ReturnType<typeof api.loginWithGoogle>>) => void;
  onError?: (message: string | null) => void;
  role?: "parent" | "provider";
  displayName?: string;
  label?: string;
};

/**
 * Mounts Google auth hooks only when the platform is fully configured.
 * Avoids crashing standalone Android builds before androidClientId exists.
 */
export function GoogleAuthSection({
  onSuccess,
  onError,
  role,
  displayName,
  label,
}: GoogleAuthSectionProps) {
  const google = useGoogleAuth({ onSuccess, role, displayName });

  useEffect(() => {
    onError?.(google.error);
  }, [google.error, onError]);

  return (
    <>
      <GoogleSignInButton
        onPress={google.signInWithGoogle}
        loading={google.loading}
        label={label}
      />
      {google.error ? <Text style={styles.error}>{google.error}</Text> : null}
      <AuthDivider />
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    color: "#dc2626",
    marginBottom: 8,
  },
});
