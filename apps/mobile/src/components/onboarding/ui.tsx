import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, layout, radii, typography } from "@/constants/theme";

export { colors };

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Phone: 16px side padding. Tablet: 20px padding, centered 560px column. */
export function useOnboardingContentStyle(opts?: { includeVertical?: boolean }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= layout.tabletMinWidth;
  const includeVertical = opts?.includeVertical !== false;
  return {
    paddingHorizontal: isTablet ? 20 : 16,
    ...(includeVertical ? { paddingTop: 16, paddingBottom: 28 } : null),
    maxWidth: layout.formMaxWidth,
    width: "100%" as const,
    alignSelf: "center" as const,
  };
}

export function OnboardingHeader({
  title,
  subtitle,
  step,
  totalSteps,
}: {
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
}) {
  return (
    <View style={headerStyles.wrap}>
      {step != null && totalSteps != null ? (
        <Text style={headerStyles.step}>
          Step {step} of {totalSteps}
        </Text>
      ) : null}
      <Text style={headerStyles.title}>{title}</Text>
      {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function OnboardingPayoff({
  title,
  body,
  primaryIcon,
  secondaryIcon,
  illustration,
  compact = false,
}: {
  title: ReactNode;
  body?: ReactNode;
  primaryIcon?: IoniconName;
  secondaryIcon?: IoniconName;
  /** Optional hero art shown beside compact title/body (phone + tablet). */
  illustration?: ImageSourcePropType;
  /** Compact chrome: no icon hero, tighter spacing (Steps 1–3). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <View style={payoffStyles.compact}>
        <View style={payoffStyles.compactRow}>
          <View style={payoffStyles.compactCopy}>
            <Text style={payoffStyles.compactTitle}>{title}</Text>
            {body ? <Text style={payoffStyles.compactBody}>{body}</Text> : null}
          </View>
          {illustration ? (
            <Image
              source={illustration}
              style={payoffStyles.compactArt}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={payoffStyles.hero}>
      {primaryIcon ? (
        <View style={payoffStyles.heroIcons}>
          <View style={payoffStyles.heroIconLg}>
            <Ionicons name={primaryIcon} size={28} color={colors.primary} />
          </View>
          {secondaryIcon ? (
            <View style={payoffStyles.heroIconSm}>
              <Ionicons name={secondaryIcon} size={16} color={colors.accent} />
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={payoffStyles.heroTitle}>{title}</Text>
      {body ? <Text style={payoffStyles.heroBody}>{body}</Text> : null}
    </View>
  );
}

export function InfoCard({ children }: { children: ReactNode }) {
  return (
    <View style={infoStyles.card}>
      <Text style={infoStyles.text}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={fieldStyles.label}>{children}</Text>;
}

export function FieldInput({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={fieldStyles.wrap}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        style={fieldStyles.input}
        placeholderTextColor={colors.textSubtle}
        {...props}
        testID={props.testID ?? "clarity-mask"}
      />
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      style={[btnStyles.primary, disabled && btnStyles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={btnStyles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[btnStyles.secondary, disabled && btnStyles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={btnStyles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[chipStyles.chip, selected && chipStyles.chipActive]}
      onPress={onPress}
    >
      <View style={chipStyles.row}>
        {selected ? (
          <Ionicons name="checkmark" size={14} color={colors.textInverse} />
        ) : null}
        <Text style={[chipStyles.text, selected && chipStyles.textActive]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function DetailRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={detailStyles.label}>{label}</Text>
      <Text
        style={[detailStyles.value, onPress ? detailStyles.valueAction : null]}
      >
        {value}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={detailStyles.row}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={detailStyles.row}>{content}</View>;
}

const headerStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  step: {
    fontSize: 13,
    fontFamily: typography.semibold,
    color: colors.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 6,
  },
});

const payoffStyles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  compact: {
    marginBottom: 12,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactArt: {
    width: 112,
    height: 112,
    marginTop: -4,
  },
  compactTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  compactBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 4,
  },
  heroIcons: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  heroIconLg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconSm: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    marginBottom: -2,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 8,
  },
});

const infoStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.primaryDark,
    fontFamily: typography.regular,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    fontSize: 13,
    fontFamily: typography.semibold,
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    fontFamily: typography.regular,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});

const btnStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: {
    color: colors.textInverse,
    fontSize: 16,
    fontFamily: typography.semibold,
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 44,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: typography.semibold,
  },
  disabled: { opacity: 0.5 },
});

const chipStyles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: { fontSize: 13, color: colors.text, fontFamily: typography.medium },
  textActive: {
    color: colors.textInverse,
    fontFamily: typography.semibold,
  },
});

const detailStyles = StyleSheet.create({
  row: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  valueAction: {
    color: colors.primary,
    fontWeight: "600",
  },
});
