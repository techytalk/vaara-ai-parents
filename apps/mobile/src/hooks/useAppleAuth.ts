import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { api } from "@/lib/api";

type UseAppleAuthOptions = {
  role?: "parent" | "provider";
  displayName?: string;
  onSuccess: (result: Awaited<ReturnType<typeof api.loginWithApple>>) => void;
};

function formatAppleFullName(
  name: AppleAuthentication.AppleAuthenticationFullName | null | undefined
): string | undefined {
  if (!name) return undefined;
  const parts = [name.givenName, name.middleName, name.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" ") : undefined;
}

export function useAppleAuth({
  role = "parent",
  displayName,
  onSuccess,
}: UseAppleAuthOptions) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setAvailable(false);
      return;
    }

    let cancelled = false;
    void AppleAuthentication.isAvailableAsync()
      .then((value) => {
        if (!cancelled) setAvailable(value);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") return;

    setError(null);
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setError("Apple did not return a sign-in token");
        return;
      }

      const appleName = formatAppleFullName(credential.fullName);
      const result = await api.loginWithApple({
        identityToken: credential.identityToken,
        role,
        displayName: displayName?.trim() || appleName,
      });
      onSuccess(result);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "ERR_REQUEST_CANCELED") {
        return;
      }
      setError(err instanceof Error ? err.message : "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [displayName, onSuccess, role]);

  return {
    signInWithApple,
    loading,
    error,
    ready: available,
  };
}
