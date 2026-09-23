import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/constants/theme";

export function EnglishTranslation({
  text,
  mine = false,
}: {
  text: string;
  mine?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, mine && styles.labelMine]}>English</Text>
      <Text style={[styles.body, mine && styles.bodyMine]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  label: {
    fontFamily: typography.medium,
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 14,
  },
  labelMine: { color: "rgba(255,255,255,0.72)" },
  body: {
    fontFamily: typography.regular,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  bodyMine: { color: "rgba(255,255,255,0.8)" },
});
