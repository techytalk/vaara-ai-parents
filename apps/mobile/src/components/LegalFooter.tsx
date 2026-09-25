import { Linking, StyleSheet, Text } from "react-native";
import { LEGAL_URLS } from "@/constants/legal";
import { colors, spacing, typography } from "@/constants/theme";

function LinkSpan({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  return (
    <Text
      accessibilityRole="link"
      style={styles.link}
      onPress={() => {
        Linking.openURL(url).catch(() => {});
      }}
    >
      {label}
    </Text>
  );
}

export function LegalFooter({
  extra = "Your real name stays private in circles.",
  compact = false,
  /** Short compliance line for fixed-height auth screens. */
  brief = false,
}: {
  extra?: string;
  /** Tighter top margin for fixed-height auth screens. */
  compact?: boolean;
  brief?: boolean;
}) {
  if (brief) {
    return (
      <Text style={[styles.text, compact && styles.textCompact]}>
        By continuing, you agree to the{" "}
        <LinkSpan label="Terms of Use" url={LEGAL_URLS.termsOfUse} />
        {" "}and{" "}
        <LinkSpan label="Privacy Policy" url={LEGAL_URLS.privacyPolicy} />
        . {extra}
      </Text>
    );
  }

  return (
    <Text style={[styles.text, compact && styles.textCompact]}>
      By continuing, you agree to the{" "}
      <LinkSpan label="Terms of Use" url={LEGAL_URLS.termsOfUse} />
      . Vaara has no tolerance for objectionable content or abusive users. We
      remove that content and may remove the account. See our{" "}
      <LinkSpan label="Privacy Policy" url={LEGAL_URLS.privacyPolicy} />
      {" "}and{" "}
      <LinkSpan
        label="Community Guidelines"
        url={LEGAL_URLS.communityGuidelines}
      />
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
