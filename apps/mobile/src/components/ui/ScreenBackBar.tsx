import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/constants/theme";

/** Compact top bar with an explicit back control for headerless iOS screens. */
export function ScreenBackBar({
  title,
  backLabel = "Back",
  onBack,
  right,
}: {
  title?: string;
  backLabel?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel}`}
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
        <Text style={styles.backText} numberOfLines={1}>
          {backLabel}
        </Text>
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titleSpacer} />
      )}
      <View style={styles.right}>{right ?? <View style={styles.rightPad} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 88,
    maxWidth: 120,
  },
  backText: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
    marginLeft: -2,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: typography.bold,
    fontSize: 17,
    color: colors.text,
  },
  titleSpacer: { flex: 1 },
  right: {
    minWidth: 88,
    maxWidth: 120,
    alignItems: "flex-end",
  },
  rightPad: { width: 28 },
});
