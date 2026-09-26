import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChildren } from "@/hooks/useSessionQueries";
import { useNavFrom, useOriginBackHeader } from "@/hooks/useOriginBack";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { Child } from "@/lib/api";

function childMeta(child: Child): string {
  if (child.track === "preschool" && child.ageYears) {
    return `${child.ageYears} years · ${child.school.displayLabel}`;
  }
  if (child.curriculum && child.grade) {
    return `${child.curriculum.name} · ${child.grade.label} · ${child.school.displayLabel}`;
  }
  return child.school.displayLabel;
}

export default function Child360ListScreen() {
  useOriginBackHeader();
  const router = useRouter();
  const from = useNavFrom();
  const childrenQuery = useChildren();
  const children = childrenQuery.data ?? [];
  const loading = childrenQuery.isPending && children.length === 0;
  const refreshing = childrenQuery.isRefetching && !childrenQuery.isPending;

  useFocusEffect(
    useCallback(() => {
      if (childrenQuery.isStale) void childrenQuery.refetch();
    }, [childrenQuery.isStale, childrenQuery.refetch])
  );

  function openHub(childId: string) {
    router.push({
      pathname: "/(app)/child-360/[childId]",
      params: {
        childId,
        ...(from ? { from } : {}),
      },
    });
  }

  function openEdit(childId: string) {
    router.push({
      pathname: "/onboarding/children/edit/[id]",
      params: { id: childId },
    });
  }

  function openAdd() {
    router.push({
      pathname: "/onboarding/children/add",
      params: { from: "child360" },
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (childrenQuery.isError && children.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Couldn’t load Child 360</Text>
        <Text style={styles.errorBody}>
          {childrenQuery.error instanceof Error
            ? childrenQuery.error.message
            : "Check your connection and try again."}
        </Text>
        <Pressable
          onPress={() => void childrenQuery.refetch()}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // One child → go straight to hub (avoid forever-spinner while replace settles).
  if (children.length === 1) {
    return (
      <Redirect
        href={{
          pathname: "/(app)/child-360/[childId]",
          params: {
            childId: children[0].id,
            ...(from ? { from } : {}),
          },
        }}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void childrenQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {children.length === 0 ? (
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
        >
          <Ionicons name="person-add-outline" size={28} color={colors.primary} />
          <Text style={styles.emptyTitle}>Add a child</Text>
          <Text style={styles.emptyBody}>
            Start with preschool or school so Child 360 can open their hub.
          </Text>
        </Pressable>
      ) : (
        children.map((child) => {
          const title =
            child.nickname?.trim() ||
            (child.track === "preschool" && child.ageYears
              ? `${child.ageYears} years`
              : child.grade?.label) ||
            "Child";
          const initial = title[0]?.toUpperCase() ?? "C";
          return (
            <Pressable
              key={child.id}
              onPress={() => openHub(child.id)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {childMeta(child)}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  openEdit(child.id);
                }}
                hitSlop={10}
                accessibilityLabel="Edit child"
              >
                <Ionicons name="create-outline" size={20} color={colors.textSubtle} />
              </Pressable>
            </Pressable>
          );
        })
      )}

      {children.length > 0 ? (
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Text style={styles.addBtnText}>+ Add a child</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  errorTitle: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  errorBody: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  retryText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.88 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.primaryDark,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: colors.text,
  },
  cardMeta: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  addBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  addBtnText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
});
