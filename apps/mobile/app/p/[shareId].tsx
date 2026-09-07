import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { savePendingLink } from "@/lib/pending-link";
import { getToken } from "@/lib/session";
import { colors } from "@/constants/theme";

export default function SharedPostGate() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = `/p/${shareId}`;
      const token = await getToken();
      if (!token) {
        await savePendingLink(path);
        if (!cancelled) setTarget("/(auth)/login");
        return;
      }
      try {
        const resolved = await api.resolveShare(token, shareId);
        if (!resolved.available || !resolved.circleId || !resolved.postId) {
          if (!cancelled) setTarget("/(app)");
          return;
        }
        if (!cancelled) {
          router.replace({
            pathname: "/circles/[circleId]/posts/[postId]",
            params: {
              circleId: resolved.circleId,
              postId: resolved.postId,
              shareId,
            },
          });
        }
      } catch {
        await savePendingLink(path);
        if (!cancelled) setTarget("/(auth)/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, shareId]);

  if (target) {
    return <Redirect href={target as never} />;
  }

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
