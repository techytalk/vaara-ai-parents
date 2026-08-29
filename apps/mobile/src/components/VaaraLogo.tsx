import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/constants/theme";

export function VaaraMark({ size = 48 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <View
        style={[
          styles.navyPerson,
          {
            width: size * 0.35,
            height: size * 0.58,
            borderRadius: size * 0.18,
            left: size * 0.14,
            top: size * 0.19,
          },
        ]}
      />
      <View
        style={[
          styles.tealPerson,
          {
            width: size * 0.36,
            height: size * 0.58,
            borderRadius: size * 0.18,
            left: size * 0.38,
            top: size * 0.3,
          },
        ]}
      />
      <View
        style={[
          styles.coralPerson,
          {
            width: size * 0.25,
            height: size * 0.42,
            borderRadius: size * 0.14,
            right: size * 0.08,
            top: size * 0.12,
          },
        ]}
      />
      <View
        style={[
          styles.head,
          {
            width: size * 0.17,
            height: size * 0.17,
            borderRadius: size * 0.09,
            left: size * 0.22,
            top: 0,
          },
        ]}
      />
      <View
        style={[
          styles.coralHead,
          {
            width: size * 0.15,
            height: size * 0.15,
            borderRadius: size * 0.08,
            right: size * 0.08,
            top: 0,
          },
        ]}
      />
    </View>
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
  navyPerson: {
    position: "absolute",
    backgroundColor: colors.navy,
    transform: [{ rotate: "-38deg" }],
  },
  tealPerson: {
    position: "absolute",
    backgroundColor: colors.teal,
    transform: [{ rotate: "38deg" }],
  },
  coralPerson: {
    position: "absolute",
    backgroundColor: colors.coral,
    transform: [{ rotate: "35deg" }],
  },
  head: { position: "absolute", backgroundColor: colors.navy },
  coralHead: { position: "absolute", backgroundColor: colors.coral },
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
