import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";

type SafetyTone = "info" | "warning" | "critical";

const toneStyles: Record<
  SafetyTone,
  { background: string; border: string; icon: string }
> = {
  info: {
    background: colors.primarySoft,
    border: colors.primaryLight,
    icon: colors.primaryDark,
  },
  warning: {
    background: "#FEF3C7",
    border: "#FCD34D",
    icon: colors.amber,
  },
  critical: {
    background: "#FEE2E2",
    border: "#FECACA",
    icon: "#B91C1C",
  },
};

export function SafetyNotice({
  message,
  tone = "warning",
}: {
  message: string;
  tone?: SafetyTone;
}) {
  const palette = toneStyles[tone];
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.container,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <Ionicons name="shield-checkmark-outline" size={18} color={palette.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  text: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.medium,
    flex: 1,
    lineHeight: 20,
  },
});
