import { Linking, StyleSheet, Text } from "react-native";
import { LEGAL_URLS } from "@/constants/legal";
import { colors, spacing, typography } from "@/constants/theme";

export function LegalFooter({
  extra = "Your real name and child details stay private in circles.",
}: {
  extra?: string;
}) {
  return (
    <Text style={styles.text}>
      By continuing, you agree to our{" "}
      <Text
        accessibilityRole="link"
        style={styles.link}
        onPress={() => {
          Linking.openURL(LEGAL_URLS.privacyPolicy).catch(() => {});
        }}
      >
        Privacy Policy
      </Text>
      {" "}and{" "}
      <Text
        accessibilityRole="link"
        style={styles.link}
        onPress={() => {
          Linking.openURL(LEGAL_URLS.communityGuidelines).catch(() => {});
        }}
      >
        Community Guidelines
      </Text>
      . {extra}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    textAlign: "center",
    marginTop: spacing.md,
  },
  link: {
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    textDecorationLine: "underline",
  },
});
