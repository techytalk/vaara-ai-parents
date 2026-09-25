import { Linking, StyleSheet, Text } from "react-native";
import { LEGAL_URLS } from "@/constants/legal";
import { colors, spacing, typography } from "@/constants/theme";

export function LegalFooter({
  extra = "Your real name stays private in circles.",
  compact = false,
}: {
  extra?: string;
  /** Tighter top margin for fixed-height auth screens. */
  compact?: boolean;
}) {
  return (
    <Text style={[styles.text, compact && styles.textCompact]}>
      By continuing, you agree to the{" "}
      <Text
        accessibilityRole="link"
        style={styles.link}
        onPress={() => {
          Linking.openURL(LEGAL_URLS.termsOfUse).catch(() => {});
        }}
      >
        Terms of Use
      </Text>
      . Vaara has no tolerance for objectionable content or abusive users. We
      remove that content and may remove the account. See our{" "}
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
  textCompact: {
    marginTop: spacing.xs,
  },
  link: {
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    textDecorationLine: "underline",
  },
});
