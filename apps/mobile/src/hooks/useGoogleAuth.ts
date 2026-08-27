import { useEffect, useRef, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/lib/api";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSignInConfigured,
} from "@/constants/google-auth";

WebBrowser.maybeCompleteAuthSession();

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
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!response) return;

    if (response.type === "dismiss" || response.type === "cancel") {
      setLoading(false);
      return;
    }

    if (response.type !== "success") {
      if (response.type === "error") {
        setError("Google sign-in was cancelled or failed");
        setLoading(false);
      }
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setError("Google did not return a sign-in token");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .loginWithGoogle({
        idToken,
        role,
        displayName: displayName?.trim() || undefined,
      })
      .then((result) => onSuccessRef.current(result))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      })
      .finally(() => setLoading(false));
  }, [response, role, displayName]);

  async function signInWithGoogle() {
    if (!configured) {
      setError("Google sign-in is not configured for this build");
      return;
    }
    if (!request) {
      setError("Google sign-in is not ready yet");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return {
    signInWithGoogle,
    loading,
    error,
    ready: configured && Boolean(request),
  };
}
