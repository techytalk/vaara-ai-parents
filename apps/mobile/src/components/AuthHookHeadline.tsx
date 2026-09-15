import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/constants/theme";

type AccentSpan = {
  text: string;
  accent?: boolean;
};

type Props = {
  kicker: string;
  /** Headline split into plain + accent parts (accent = teal + underline). */
  headline: AccentSpan[];
  lead: AccentSpan[] | string;
};

function renderSpans(parts: AccentSpan[], accentStyle: object) {
  return parts.map((part, index) => (
    <Text key={`${part.text}-${index}`} style={part.accent ? accentStyle : undefined}>
      {part.text}
    </Text>
  ));
}

export function AuthHookHeadline({ kicker, headline, lead }: Props) {
  const leadParts = typeof lead === "string" ? [{ text: lead }] : lead;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.headline}>
        {renderSpans(headline, styles.headlineAccent)}
      </Text>
      <Text style={styles.lead}>
        {renderSpans(leadParts, styles.leadAccent)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.caption,
    fontFamily: typography.bold,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  headline: {
    ...typography.display,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -0.8,
  },
  headlineAccent: {
    color: colors.primary,
    textDecorationLine: "underline",
    textDecorationColor: colors.primaryLight,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  leadAccent: {
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
});
