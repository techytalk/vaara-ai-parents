import { StyleSheet, Text, View } from "react-native";
import type { AuthDensityBand } from "@/components/AuthScreenShell";
import { colors, spacing, typography } from "@/constants/theme";

type AccentSpan = {
  text: string;
  accent?: boolean;
};

type Props = {
  kicker: string;
  /** Headline split into plain + accent parts (accent = teal + underline). */
  headline: AccentSpan[];
  lead?: AccentSpan[] | string;
  /** Height band from AuthScreenShell — short phones use smaller type. */
  band?: AuthDensityBand;
  /** Cap headline lines on short devices (default 3). */
  headlineLines?: number;
};

function renderSpans(parts: AccentSpan[], accentStyle: object) {
  return parts.map((part, index) => (
    <Text key={`${part.text}-${index}`} style={part.accent ? accentStyle : undefined}>
      {part.text}
    </Text>
  ));
}

export function AuthHookHeadline({
  kicker,
  headline,
  lead,
  band = "regular",
  headlineLines,
}: Props) {
  const leadParts =
    lead == null
      ? []
      : typeof lead === "string"
        ? [{ text: lead }]
        : lead;
  const showLead = leadParts.length > 0 && band === "tall";
  const maxLines = headlineLines ?? (band === "short" ? 3 : undefined);
  const compact = band === "short";

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.kicker, compact && styles.kickerCompact]}>{kicker}</Text>
      <Text
        style={[styles.headline, compact && styles.headlineCompact]}
        numberOfLines={maxLines}
      >
        {renderSpans(headline, styles.headlineAccent)}
      </Text>
      {showLead ? (
        <Text style={styles.lead} numberOfLines={2}>
          {renderSpans(leadParts, styles.leadAccent)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  wrapCompact: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  kicker: {
    ...typography.caption,
    fontFamily: typography.bold,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  kickerCompact: {
    marginBottom: 4,
  },
  headline: {
    ...typography.display,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -0.8,
  },
  headlineCompact: {
    ...typography.screenTitle,
    fontFamily: typography.bold,
    letterSpacing: -0.4,
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
