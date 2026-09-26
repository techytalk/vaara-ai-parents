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

const PREVIEW_MAX = 2;

function previewLines(items: string[], max = PREVIEW_MAX): string[] {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];
  if (cleaned.length <= max) return cleaned;
  const shown = cleaned.slice(0, max);
  const rest = cleaned.length - shown.length;
  return [...shown, `… +${rest} more`];
}

function SideCard({
  title,
  lines,
  emptyLabel = "+ Add",
  onPress,
}: {
  title: string;
  lines: string[];
  emptyLabel?: string;
  onPress: () => void;
}) {
  const filled = lines.length > 0;
  const a11y = filled ? `${title}. ${lines.join(", ")}` : `${title}. ${emptyLabel}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.side,
        filled && styles.sideFilled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.sideTitle}>{title}</Text>
      {filled ? (
        <View style={styles.points}>
          {lines.map((line, index) => (
            <View key={`${line}-${index}`} style={styles.pointRow}>
              <View style={styles.pointDot} />
              <Text style={styles.pointText} numberOfLines={1}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sideEmpty}>{emptyLabel}</Text>
      )}
    </Pressable>
  );
}

export function Child360Cross({ data, onLeft, onTop, onRight, onBottom }: Props) {
  const { child } = data;
  const centre = centreName(child);
  const isPreschool = child.track === "preschool";

  const leftTitle = isPreschool ? "Preschool" : "Studies";
  let leftLines: string[];
  if (isPreschool) {
    leftLines = previewLines([child.school.displayLabel], 2);
  } else if (child.curriculum?.name || child.grade?.label) {
    leftLines = previewLines(
      [
        child.curriculum?.name ?? null,
        child.grade?.label?.replace(/^Grade\s+/i, "") ?? null,
      ].filter((v): v is string => Boolean(v)),
      2
    );
  } else {
    leftLines = [];
  }

  const topTitle = isPreschool ? "Activities" : "Sports";
  const activityNames: string[] = [];
  const seenNames = new Set<string>();
  for (const status of ["active", "paused"] as const) {
    for (const row of data.activities) {
      if (row.status !== status) continue;
      const key = row.name.trim().toLowerCase();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      activityNames.push(row.name.trim());
    }
  }
  const topLines = previewLines(activityNames, PREVIEW_MAX);

  const bottomLines =
    data.healthNotes.length > 0
      ? [
          `${data.healthNotes.length} note${
            data.healthNotes.length === 1 ? "" : "s"
          }`,
        ]
      : [];

  let rightTitle = "Interests";
  let rightLines: string[] = [];
  if (child.rightBand === "enjoy") {
    rightTitle = "Exams";
    rightLines = previewLines(data.interests, PREVIEW_MAX);
  } else if (child.rightBand === "pathway_lean") {
    rightTitle = "Exams";
    const lean = pathwayLeanDisplay(data.hub.pathwayLean);
    rightLines = lean ? [lean] : [];
  } else if (child.rightBand === "opportunities") {
    rightTitle = "Exams";
    rightLines = previewLines(
      data.opportunityPlans.map((p) => p.opportunitySlug),
      PREVIEW_MAX
    );
  } else {
    rightLines = previewLines(data.interests, PREVIEW_MAX);
  }

  return (
    <View style={styles.cross}>
      <View style={styles.rowCenter}>
        <SideCard title={topTitle} lines={topLines} onPress={onTop} />
      </View>
      <View style={styles.rowMid}>
        <SideCard
          title={leftTitle}
          lines={leftLines}
          emptyLabel={isPreschool ? "+ Add" : "Open path"}
          onPress={onLeft}
        />
        <View style={styles.centre}>
          <Text style={styles.centreTitle} numberOfLines={1}>
            {centre.title}
          </Text>
          <Text style={styles.centreSub} numberOfLines={1}>
            {centre.subtitle}
          </Text>
        </View>
        <SideCard title={rightTitle} lines={rightLines} onPress={onRight} />
      </View>
      <View style={styles.rowCenter}>
        <SideCard title="Health" lines={bottomLines} onPress={onBottom} />
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
    width: 118,
    minHeight: 76,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "stretch",
    justifyContent: "center",
  },
  sideFilled: {
    borderColor: colors.primarySoft,
  },
  pressed: { opacity: 0.85 },
  sideTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  sideEmpty: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  points: {
    gap: 3,
    alignItems: "stretch",
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pointDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  pointText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
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
