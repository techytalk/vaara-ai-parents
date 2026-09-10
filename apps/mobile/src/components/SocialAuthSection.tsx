import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppleAuthSection } from "@/components/AppleAuthSection";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { api } from "@/lib/api";

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

  useEffect(() => {
    onError?.(appleError ?? googleError);
  }, [appleError, googleError, onError]);

  return (
    <View style={{ gap: 10 }}>
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
    </View>
  );
}
