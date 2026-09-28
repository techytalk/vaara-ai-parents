import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { Child360Hub } from "@/lib/api";
import { centreName } from "@/constants/child-360";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  data: Child360Hub;
  examMatchCount?: number;
  onLeft: () => void;
  onTop: () => void;
  onRight: () => void;
  onBottom: () => void;
};

function summaryLine(items: string[]): string | null {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} · ${cleaned[1]}`;
  return `${cleaned[0]} · ${cleaned[1]}  +${cleaned.length - 2}`;
}

function SideCard({
  title,
  icon,
  summary,
  emptyLabel = "Add",
  wide,
  onPress,
}: {
  title: string;
  icon: IconName;
  summary: string | null;
  emptyLabel?: string;
  wide?: boolean;
  onPress: () => void;
}) {
  const filled = Boolean(summary);
  const a11y = filled ? `${title}. ${summary}` : `${title}. ${emptyLabel}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.side,
        wide && styles.sideWide,
        filled && styles.sideFilled,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, filled && styles.iconWrapOn]}>
        <Ionicons
          name={icon}
          size={16}
          color={filled ? colors.primaryDark : colors.textMuted}
        />
      </View>
      <Text style={styles.sideTitle}>{title}</Text>
      <Text
        style={filled ? styles.sideSummary : styles.sideEmpty}
        numberOfLines={2}
      >
        {filled ? summary : emptyLabel}
      </Text>
    </Pressable>
  );
}

export function Child360Cross({
  data,
  examMatchCount = 0,
  onLeft,
  onTop,
  onRight,
  onBottom,
}: Props) {
  const { child } = data;
  const centre = centreName(child);
  const isPreschool = child.track === "preschool";

  const leftTitle = isPreschool ? "Preschool" : "Studies";
  const leftIcon: IconName = isPreschool ? "happy-outline" : "school-outline";
  let leftItems: string[];
  if (isPreschool) {
    leftItems = [child.school.displayLabel];
  } else if (child.curriculum?.name || child.grade?.label) {
    leftItems = [
      child.curriculum?.name ?? null,
      child.grade?.label ?? null,
    ].filter((v): v is string => Boolean(v));
  } else {
    leftItems = [];
  }

  const topTitle = isPreschool ? "Activities" : "Sports";
  const topIcon: IconName = isPreschool ? "color-palette-outline" : "football-outline";
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
  const topSummary = summaryLine(activityNames);

  const healthSummary =
    data.healthNotes.length > 0
      ? `${data.healthNotes.length} note${data.healthNotes.length === 1 ? "" : "s"}`
      : null;

  const examsCard =
    child.rightBand === "enjoy" ||
    child.rightBand === "pathway_lean" ||
    child.rightBand === "opportunities";
  let rightTitle = "Interests";
  let rightIcon: IconName = "sparkles-outline";
  let rightSummary: string | null = summaryLine(data.interests);
  if (examsCard) {
    rightTitle = "Exams";
    rightIcon = "trophy-outline";
    rightSummary = examMatchCount > 0 ? `${examMatchCount} for this class` : null;
  }

  return (
    <View style={styles.cross}>
      <View style={styles.rowCenter}>
        <SideCard
          wide
          title={topTitle}
          icon={topIcon}
          summary={topSummary}
          onPress={onTop}
        />
      </View>
      <View style={styles.rowMid}>
        <SideCard
          title={leftTitle}
          icon={leftIcon}
          summary={summaryLine(leftItems)}
          emptyLabel={isPreschool ? "Add" : "Open path"}
          onPress={onLeft}
        />
        <View style={styles.centre}>
          <Text style={styles.centreTitle} numberOfLines={2}>
            {centre.title}
          </Text>
          <Text style={styles.centreSub} numberOfLines={2}>
            {centre.subtitle}
          </Text>
        </View>
        <SideCard
          title={rightTitle}
          icon={rightIcon}
          summary={rightSummary}
          emptyLabel={examsCard ? "See matches" : "Add"}
          onPress={onRight}
        />
      </View>
      <View style={styles.rowCenter}>
        <SideCard
          wide
          title="Health"
          icon="heart-outline"
          summary={healthSummary}
          onPress={onBottom}
        />
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
    flex: 1,
    minHeight: 108,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sideWide: {
    flex: 0,
    width: "72%",
    minHeight: 88,
  },
  sideFilled: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.88 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  iconWrapOn: {
    backgroundColor: colors.primarySoft,
  },
  sideTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: colors.text,
    textAlign: "center",
  },
  sideSummary: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: "center",
  },
  sideEmpty: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.primary,
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
