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
import { colors, radii, spacing, typography } from "@/constants/theme";
import { ApiError, api, type Child360Hub } from "@/lib/api";
import { childSwitcherTabLabel } from "@/lib/child-switcher-label";
import { backLabelForOrigin, leaveToOrigin } from "@/lib/nav-back";
import { getToken } from "@/lib/session";
import { useNavFrom } from "@/hooks/useOriginBack";
import { useChildren } from "@/hooks/useSessionQueries";

export default function Child360HubScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const from = useNavFrom();
  const router = useRouter();
  const navigation = useNavigation();
  const childrenQuery = useChildren();
  const children = childrenQuery.data ?? [];
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
  }, [childId, router, refetchChildren]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void childrenQuery.refetch().catch(() => undefined);
      setLoading(true);
      load()
        .catch((e) => {
          if (active) {
            setError(e instanceof Error ? e.message : "Failed to load");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load])
  );

  function selectChild(nextId: string) {
    if (nextId === childId) return;
    router.replace({
      pathname: "/(app)/child-360/[childId]",
      params: {
        childId: nextId,
        ...(from ? { from } : {}),
      },
    } as never);
  }

  useLayoutEffect(() => {
    const multi = children.length > 1;
    const label = backLabelForOrigin(from ?? "more");
    navigation.setOptions({
      headerLeft: from
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Back to ${label}`}
              onPress={() => leaveToOrigin(router, { from, childId })}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={styles.editLink}>‹ {label}</Text>
            </Pressable>
          )
        : multi
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="All children"
                onPress={() => router.push("/(app)/child-360" as never)}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Text style={styles.editLink}>‹ Children</Text>
              </Pressable>
            )
          : undefined,
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/onboarding/children/add",
                params: { from: "child360" },
              })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add a child"
          >
            <Text style={styles.editLink}>Add</Text>
          </Pressable>
          <View style={styles.headerDivider} />
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/onboarding/children/edit/[id]",
                params: { id: childId, from: "child360" },
              })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit child"
          >
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
      ),
    });
  }, [childId, children.length, from, navigation, router]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([load(), refetchChildren()]);
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
      params: { childId, from: "child360" },
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
      {children.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {children.map((child, index) => {
            const selected = child.id === childId;
            return (
              <Pressable
                key={child.id}
                onPress={() => selectChild(child.id)}
                style={[styles.childChip, selected && styles.childChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={childSwitcherTabLabel(
                  {
                    nickname: child.nickname,
                    curriculumCode: child.curriculum?.code ?? null,
                    curriculumName: child.curriculum?.name ?? null,
                    gradeLabel: child.grade?.label ?? null,
                    ageYears: child.ageYears,
                    track: child.track,
                  },
                  index
                )}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextOn]}
                  numberOfLines={2}
                >
                  {childSwitcherTabLabel(
                    {
                      nickname: child.nickname,
                      curriculumCode: child.curriculum?.code ?? null,
                      curriculumName: child.curriculum?.name ?? null,
                      gradeLabel: child.grade?.label ?? null,
                      ageYears: child.ageYears,
                      track: child.track,
                    },
                    index
                  )}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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
  chipScroll: { marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: "row",
  },
  childChip: {
    maxWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  childChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  chipTextOn: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
  },
  editLink: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.primary,
    paddingHorizontal: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 4,
  },
  headerDivider: {
    width: 1.5,
    height: 14,
    backgroundColor: colors.primary,
    opacity: 0.55,
    borderRadius: 1,
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
