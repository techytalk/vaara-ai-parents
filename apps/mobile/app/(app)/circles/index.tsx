import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, type Circle } from "@/lib/api";
import { getToken } from "@/lib/session";
import {
  EmptyState,
  InlineError,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";

const order: Circle["circleType"][] = [
  "school_class",
  "class",
  "school",
  "community",
  "locality",
  "curriculum",
];

const groupDescriptions: Partial<Record<Circle["circleType"], string>> = {
  school_class: "Parents in your child's exact school and class",
  class: "Parents with children in the same curriculum and grade",
  school: "The wider parent community at your child's school",
  community: "Parents in your apartment or gated community",
  locality: "Parents near your pin code",
  curriculum: "Parents following the same curriculum",
};

export default function CirclesOverviewScreen() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again");
      const response = await api.getCircles(token);
      setCircles(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load circles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(
    () =>
      order
        .map((type) => ({
          type,
          items: circles.filter((circle) => circle.circleType === type),
        }))
        .filter((group) => group.items.length > 0),
    [circles]
  );

  if (loading) return <ScreenLoader label="Finding your circles" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={styles.eyebrow}>Your parent network</Text>
      <Text style={styles.title}>My Circles</Text>
      <Text style={styles.intro}>
        Your profile automatically connects you to the parents most relevant
        to your family.
      </Text>

      {error ? <InlineError message={error} onRetry={load} /> : null}

      {!error && circles.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Your circles are being formed"
          message="Add your child's school, curriculum, grade and your location to find the right parent communities."
          actionLabel="Complete profile"
          onAction={() => router.push("/onboarding/children")}
        />
      ) : null}

      {groups.map((group) => (
        <View key={group.type} style={styles.group}>
          <SectionHeader title={CIRCLE_TYPE_LABELS[group.type]} />
          <Text style={styles.groupDescription}>
            {groupDescriptions[group.type]}
          </Text>
          <View style={styles.list}>
            {group.items.map((circle) => (
              <Pressable
                key={circle.id}
                accessibilityRole="button"
                accessibilityLabel={`${circle.displayName}, ${circle.memberCount} parents`}
                onPress={() =>
                  router.push({
                    pathname: "/circles/[circleId]",
                    params: { circleId: circle.id, title: circle.displayName },
                  })
                }
                style={({ pressed }) => [
                  styles.circle,
                  pressed && styles.circlePressed,
                ]}
              >
                <View style={styles.circleIcon}>
                  <Ionicons
                    name={iconForType(circle.circleType)}
                    size={21}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.circleCopy}>
                  <Text style={styles.circleName}>{circle.displayName}</Text>
                  <Text style={styles.circleMeta}>
                    {circle.memberCount === 1
                      ? "1 parent"
                      : `${circle.memberCount} parents`}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSubtle}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function iconForType(type: Circle["circleType"]) {
  const icons: Record<Circle["circleType"], keyof typeof Ionicons.glyphMap> = {
    curriculum: "library-outline",
    locality: "location-outline",
    community: "home-outline",
    school: "school-outline",
    class: "people-outline",
    school_class: "shield-checkmark-outline",
  };
  return icons[type];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginTop: spacing.xs,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  group: { marginTop: spacing.md },
  groupDescription: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.xs },
  circle: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circlePressed: { opacity: 0.72 },
  circleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  circleCopy: { flex: 1 },
  circleName: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  circleMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    marginTop: 2,
  },
});
