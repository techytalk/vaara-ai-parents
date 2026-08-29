import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { api } from "@/lib/api";
import { isGoogleSignInConfigured } from "@/constants/google-auth";

type GoogleAuthSectionProps = {
  onSuccess: (result: Awaited<ReturnType<typeof api.loginWithGoogle>>) => void;
  onError?: (message: string | null) => void;
  role?: "parent" | "provider";
  displayName?: string;
  label?: string;
};

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

  if (!isGoogleSignInConfigured()) {
    return null;
  }

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
