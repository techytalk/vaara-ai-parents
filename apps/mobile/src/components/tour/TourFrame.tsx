import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { colors, shadows } from "@/constants/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function TourFrame({
  step,
  total = 3,
  title,
  subtitle,
  children,
  footer,
  onSkip,
  style,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer: ReactNode;
  onSkip: () => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.screen, style]}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {Array.from({ length: total }, (_, index) => (
            <View
              key={index}
              style={[styles.dot, index === step - 1 && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>{children}</View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

export function TourHero({
  primaryIcon,
  secondaryIcon,
}: {
  primaryIcon: IoniconName;
  secondaryIcon: IoniconName;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroLg}>
        <Ionicons name={primaryIcon} size={36} color={colors.primary} />
      </View>
      <View style={styles.heroSm}>
        <Ionicons name={secondaryIcon} size={18} color={colors.accent} />
      </View>
    </View>
  );
}

export function circleTypeIcon(type: string): IoniconName {
  switch (type) {
    case "locality":
      return "home";
    case "school":
      return "school";
    case "school_class":
    case "class":
      return "people";
    case "curriculum":
      return "library";
    case "community":
      return "business";
    default:
      return "ellipse";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  skip: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
  },
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },
  footer: {
    marginTop: 20,
  },
  hero: {
    alignItems: "center",
    marginBottom: 20,
  },
  heroLg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  heroSm: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -16,
    marginLeft: 52,
    ...shadows.card,
  },
});
