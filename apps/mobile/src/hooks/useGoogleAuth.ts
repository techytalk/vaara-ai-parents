import { useEffect, useState } from "react";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { api } from "@/lib/api";
import {
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSignInConfigured,
} from "@/constants/google-auth";

type UseGoogleAuthOptions = {
  role?: "parent" | "provider";
  displayName?: string;
  onSuccess: (result: Awaited<ReturnType<typeof api.loginWithGoogle>>) => void;
};

export function useGoogleAuth({
  role = "parent",
  displayName,
  onSuccess,
}: UseGoogleAuthOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isGoogleSignInConfigured();

  useEffect(() => {
    if (!configured || !GOOGLE_WEB_CLIENT_ID) return;

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }, [configured]);

  async function signInWithGoogle() {
    if (!configured) {
      setError("Google sign-in is not configured for this build");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        setError("Google did not return a sign-in token");
        return;
      }

      const result = await api.loginWithGoogle({
        idToken,
        role,
        displayName: displayName?.trim() || undefined,
      });
      onSuccess(result);
    } catch (err) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          setError("Google sign-in is already in progress");
          return;
        }
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError("Google Play Services is not available on this device");
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return {
    signInWithGoogle,
    loading,
    error,
    ready: configured,
  };
}
