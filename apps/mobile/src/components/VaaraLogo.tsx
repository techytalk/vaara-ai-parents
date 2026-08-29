import { Image, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/constants/theme";

const logoSource = require("../../assets/splash-icon.png");

export function VaaraMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={logoSource}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function VaaraLogo({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <View
      style={styles.logoRow}
      accessibilityRole="image"
      accessibilityLabel="Vaara. Stronger parents. Happier kids."
    >
      <VaaraMark size={compact ? 38 : 52} />
      <View>
        <Text
          style={[
            styles.wordmark,
            compact && styles.wordmarkCompact,
            light && styles.lightText,
          ]}
        >
          vaara
        </Text>
        {!compact ? (
          <Text style={[styles.tagline, light && styles.lightMuted]}>
            Stronger parents. Happier kids.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: {
    color: colors.navy,
    fontFamily: typography.bold,
    fontSize: 34,
    letterSpacing: -1.7,
    lineHeight: 38,
  },
  wordmarkCompact: { fontSize: 24, lineHeight: 28, letterSpacing: -1.1 },
  tagline: {
    color: colors.textMuted,
    fontFamily: typography.medium,
    fontSize: 8,
    letterSpacing: 0.1,
  },
  lightText: { color: colors.textInverse },
  lightMuted: { color: colors.primaryLight },
});
