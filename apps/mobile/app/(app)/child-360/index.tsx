import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChildren } from "@/hooks/useSessionQueries";
import { useNavFrom, useOriginBackHeader } from "@/hooks/useOriginBack";
import { getLastChild360Id } from "@/lib/child360-last";
import { colors, radii, spacing, typography } from "@/constants/theme";

export default function Child360ListScreen() {
  useOriginBackHeader();
  const router = useRouter();
  const from = useNavFrom();
  const childrenQuery = useChildren();
  const children = childrenQuery.data ?? [];
  const loading = childrenQuery.isPending && children.length === 0;

  useFocusEffect(
    useCallback(() => {
      if (childrenQuery.isStale) void childrenQuery.refetch();
    }, [childrenQuery.isStale, childrenQuery.refetch])
  );

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

  if (children.length > 0) {
    const childId = getLastChild360Id(children.map((child) => child.id));
    if (childId) {
      return (
        <Redirect
          href={{
            pathname: "/(app)/child-360/[childId]",
            params: {
              childId,
              ...(from ? { from } : {}),
            },
          }}
        />
      );
    }
  }

  return (
    <View style={styles.centered}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.88 },
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
});
