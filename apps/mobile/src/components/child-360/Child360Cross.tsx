import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { Child360Hub } from "@/lib/api";
import {
  centreName,
  pathwayLeanDisplay,
} from "@/constants/child-360";

type Props = {
  data: Child360Hub;
  onLeft: () => void;
  onTop: () => void;
  onRight: () => void;
  onBottom: () => void;
};

function SideCard({
  title,
  preview,
  onPress,
}: {
  title: string;
  preview: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${preview}`}
      onPress={onPress}
      style={({ pressed }) => [styles.side, pressed && styles.pressed]}
    >
      <Text style={styles.sideTitle}>{title}</Text>
      <Text style={styles.sidePreview} numberOfLines={2}>
        {preview}
      </Text>
    </Pressable>
  );
}

export function Child360Cross({ data, onLeft, onTop, onRight, onBottom }: Props) {
  const { child, hub } = data;
  const centre = centreName(child);
  const isPreschool = child.track === "preschool";

  const leftTitle = isPreschool ? "Preschool" : "Studies";
  const leftPreview = isPreschool
    ? child.school.displayLabel
    : child.curriculum?.name && child.grade?.label
      ? `${child.curriculum.name} · ${child.grade.label.replace(/^Grade\s+/i, "")}`
      : "Open path";

  const topTitle = isPreschool ? "Activities" : "Sports";
  const topPreview = hub.activityName ?? "+ Add";

  const bottomPreview =
    hub.healthNoteCount > 0
      ? `${hub.healthNoteCount} note${hub.healthNoteCount === 1 ? "" : "s"}`
      : "+ Add";

  let rightTitle = "Interests";
  let rightPreview = hub.interestPreview ?? "+ Add";
  if (child.rightBand === "enjoy") {
    rightTitle = "Exams";
    rightPreview = hub.interestPreview ?? "+ Add";
  } else if (child.rightBand === "pathway_lean") {
    rightTitle = "Exams";
    rightPreview = pathwayLeanDisplay(hub.pathwayLean) ?? "+ Add";
  } else if (child.rightBand === "opportunities") {
    rightTitle = "Exams";
    rightPreview = hub.opportunityPreview?.toUpperCase() ?? "+ Add";
  }

  return (
    <View style={styles.cross}>
      <View style={styles.rowCenter}>
        <SideCard title={topTitle} preview={topPreview} onPress={onTop} />
      </View>
      <View style={styles.rowMid}>
        <SideCard title={leftTitle} preview={leftPreview} onPress={onLeft} />
        <View style={styles.centre}>
          <Text style={styles.centreTitle} numberOfLines={1}>
            {centre.title}
          </Text>
          <Text style={styles.centreSub} numberOfLines={1}>
            {centre.subtitle}
          </Text>
        </View>
        <SideCard title={rightTitle} preview={rightPreview} onPress={onRight} />
      </View>
      <View style={styles.rowCenter}>
        <SideCard title="Health" preview={bottomPreview} onPress={onBottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cross: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  rowCenter: {
    alignItems: "center",
  },
  rowMid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  side: {
    width: 108,
    minHeight: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  sideTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  sidePreview: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  centre: {
    width: 112,
    minHeight: 112,
    borderRadius: 56,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  centreTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.primaryDark,
    letterSpacing: 0.4,
  },
  centreSub: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
