import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { api } from "@/lib/api";
import { resolveParentOnboardingHref } from "@/lib/auth-navigation";
import { getToken, saveSession } from "@/lib/session";
import { colors } from "@/constants/theme";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setTarget("/(auth)/register");
        setLoading(false);
        return;
      }

      try {
        const user = await api.me(token);
        await saveSession(token, user);

        if (!user.onboardingComplete) {
          if (user.role === "provider") {
            setTarget("/onboarding/provider");
          } else {
            setTarget(await resolveParentOnboardingHref(token));
          }
        } else if (user.role === "provider") {
          setTarget("/(provider)");
        } else {
          setTarget("/(app)");
        }
      } catch {
        setTarget("/(auth)/login");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={target as never} />;
}
