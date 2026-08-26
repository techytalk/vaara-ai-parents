import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { api } from "@/lib/api";
import { getToken, saveSession } from "@/lib/session";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setTarget("/(auth)/login");
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
            setTarget("/onboarding/children");
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={target as never} />;
}
