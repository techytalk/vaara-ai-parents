import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { AppleAuthSection } from "@/components/AppleAuthSection";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { AuthDivider } from "@/components/GoogleSignInButton";
import { api } from "@/lib/api";
import { isGoogleSignInConfigured } from "@/constants/google-auth";

type SocialAuthSectionProps = {
  onSuccess: (
    result: Awaited<ReturnType<typeof api.login>>,
    method: "google" | "apple"
  ) => void;
  onError?: (message: string | null) => void;
  role?: "parent" | "provider";
  displayName?: string;
  googleLabel?: string;
  appleButtonType?: "signIn" | "signUp";
};

export function SocialAuthSection({
  onSuccess,
  onError,
  role,
  displayName,
  googleLabel,
  appleButtonType = "signIn",
}: SocialAuthSectionProps) {
  const [appleError, setAppleError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const showGoogle = isGoogleSignInConfigured();

  useEffect(() => {
    onError?.(appleError ?? googleError);
  }, [appleError, googleError, onError]);

  return (
    <>
      <AppleAuthSection
        onSuccess={(result) => onSuccess(result, "apple")}
        onError={setAppleError}
        role={role}
        displayName={displayName}
        buttonType={appleButtonType}
      />
      <GoogleAuthSection
        onSuccess={(result) => onSuccess(result, "google")}
        onError={setGoogleError}
        role={role}
        displayName={displayName}
        label={googleLabel}
        showDivider={false}
      />
      {showGoogle || Platform.OS === "ios" ? <AuthDivider /> : null}
    </>
  );
}
