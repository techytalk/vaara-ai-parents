import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { Child360Cross } from "@/components/child-360/Child360Cross";
import { childHeadline } from "@/constants/child-360";
import { colors, spacing, typography } from "@/constants/theme";
import { ApiError, api, type Child360Hub } from "@/lib/api";
import { getToken } from "@/lib/session";
import { useChildren } from "@/hooks/useSessionQueries";

export default function Child360HubScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const childrenQuery = useChildren();
  const refetchChildren = childrenQuery.refetch;
  const [data, setData] = useState<Child360Hub | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingChildRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!childId) {
      setError("Missing child");
      setLoading(false);
      return;
    }
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    loadingChildRef.current = childId;
    try {
      const hub = await api.getChild360(token, childId);
      if (loadingChildRef.current !== childId) return;
      setData(hub);
      setError(null);
    } catch (e) {
      if (loadingChildRef.current !== childId) return;
      if (e instanceof ApiError && e.status === 404) {
        const result = await refetchChildren().catch(() => null);
        const kids = result?.data ?? childrenQuery.data ?? [];
        const stillThere = kids.some((k) => k.id === childId);
        if (!stillThere) {
          // Child was deleted — leave this hub. Do not replace onto the same id.
          if (kids.length === 1) {
            router.replace({
              pathname: "/(app)/child-360/[childId]",
              params: { childId: kids[0].id },
            } as never);
          } else {
            router.replace("/(app)/child-360" as never);
          }
          return;
        }
        setError(
          "Child 360 is not available on this API yet. Start the local API or deploy the new routes."
        );
        setData(null);
        return;
      }
      throw e;
    }
  }, [childId, router, refetchChildren, childrenQuery.data]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/onboarding/children/edit/[id]",
              params: { id: childId },
            })
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit child"
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, childId]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setRefreshing(false);
    }
  }

  function openLeft() {
    if (!data) return;
    if (data.child.track === "preschool") {
      router.push({
        pathname: "/(app)/child-360/[childId]/preschool",
        params: { childId },
      });
      return;
    }
    router.push({
      pathname: "/(app)/pathways",
      params: { childId },
    });
  }

  function openTop() {
    router.push({
      pathname: "/(app)/child-360/[childId]/activities",
      params: { childId },
    });
  }

  function openBottom() {
    router.push({
      pathname: "/(app)/child-360/[childId]/health",
      params: { childId },
    });
  }

  function openRight() {
    if (!data) return;
    const band = data.child.rightBand;
    if (band === "pathway_lean") {
      router.push({
        pathname: "/(app)/child-360/[childId]/pathway-lean",
        params: { childId },
      });
      return;
    }
    if (band === "opportunities") {
      router.push({
        pathname: "/(app)/child-360/[childId]/opportunities",
        params: { childId },
      });
      return;
    }
    router.push({
      pathname: "/(app)/child-360/[childId]/interests",
      params: { childId },
    });
  }

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => void onRefresh()}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(app)/child-360" as never)}
          style={{ marginTop: 12 }}
        >
          <Text style={styles.retry}>Back to Child 360</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.headline}>{childHeadline(data.child)}</Text>
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
      <Child360Cross
        data={data}
        onLeft={openLeft}
        onTop={openTop}
        onRight={openRight}
        onBottom={openBottom}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  headline: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  editLink: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.primary,
    paddingHorizontal: 4,
  },
  error: {
    fontFamily: typography.regular,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  errorInline: {
    fontFamily: typography.regular,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  retry: {
    fontFamily: typography.semibold,
    color: colors.primary,
    fontSize: 16,
  },
});
