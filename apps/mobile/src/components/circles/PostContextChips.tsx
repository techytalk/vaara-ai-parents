import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { circleChipLabel } from "@/lib/circle-display";
import type { CirclePost } from "@/lib/api";

/**
 * Circles a post was shared to plus its interests, shown under the media.
 * Circle chips are filled, interest chips outlined, so the two read apart
 * without needing section labels.
 */
export function PostContextChips({
  circles,
  topics,
  excludeCircleId,
}: {
  circles?: CirclePost["circles"];
  topics?: CirclePost["topics"];
  excludeCircleId?: string;
}) {
  const router = useRouter();
  // The circle you are already reading in is redundant here.
  const otherCircles = (circles ?? []).filter(
    (circle) => circle.id !== excludeCircleId
  );
  const interests = topics ?? [];

  if (otherCircles.length === 0 && interests.length === 0) return null;

  return (
    <View style={styles.row}>
      {otherCircles.map((circle) => (
        <Pressable
          key={circle.id}
          style={[styles.chip, styles.circleChip]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Open circle ${circle.displayName}`}
          onPress={() =>
            router.push({
              pathname: "/circles/[circleId]",
              params: { circleId: circle.id, title: circle.displayName },
            })
          }
        >
          <Ionicons
            name="people-outline"
            size={12}
            color={colors.primaryDark}
          />
          <Text style={[styles.chipText, styles.circleChipText]}>
            {circleChipLabel(circle)}
          </Text>
        </Pressable>
      ))}
      {interests.map((topic) => (
        <Pressable
          key={topic.slug}
          style={[styles.chip, styles.topicChip]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Open interest ${topic.name}`}
          onPress={() =>
            router.push({
              pathname: "/(app)/topics/[slug]",
              params: { slug: topic.slug, title: topic.name },
            })
          }
        >
          <Ionicons
            name="pricetag-outline"
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.chipText, styles.topicChipText]}>
            {topic.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    maxWidth: "100%",
  },
  circleChip: {
    backgroundColor: colors.primarySoft,
  },
  topicChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: {
    ...typography.caption,
    fontFamily: typography.semibold,
    flexShrink: 1,
  },
  circleChipText: { color: colors.primaryDark },
  topicChipText: { color: colors.textMuted },
});
