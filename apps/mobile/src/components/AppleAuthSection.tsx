import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAppleAuth } from "@/hooks/useAppleAuth";
import { api } from "@/lib/api";
import { radii } from "@/constants/theme";

type AppleAuthSectionProps = {
  onSuccess: (result: Awaited<ReturnType<typeof api.loginWithApple>>) => void;
  onError?: (message: string | null) => void;
  role?: "parent" | "provider";
  displayName?: string;
  buttonType?: "signIn" | "signUp";
};

export function AppleAuthSection({
  onSuccess,
  onError,
  role,
  displayName,
  buttonType = "signIn",
}: AppleAuthSectionProps) {
  const apple = useAppleAuth({ onSuccess, role, displayName });

  useEffect(() => {
    onError?.(apple.error);
  }, [apple.error, onError]);

  if (!apple.ready) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {apple.loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            buttonType === "signUp"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radii.md}
          style={styles.button}
          onPress={apple.signInWithApple}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 12,
  },
  button: {
    width: "100%",
    height: 50,
  },
  placeholder: {
    width: "100%",
    height: 50,
    borderRadius: radii.md,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
});
