import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, typography } from "@/constants/theme";

export { colors };

type IoniconName = ComponentProps<typeof Ionicons>["name"];

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
}: {
  title: string;
  body: string;
  primaryIcon: IoniconName;
  secondaryIcon: IoniconName;
}) {
  return (
    <View style={payoffStyles.hero}>
      <View style={payoffStyles.heroIcons}>
        <View style={payoffStyles.heroIconLg}>
          <Ionicons name={primaryIcon} size={28} color={colors.primary} />
        </View>
        <View style={payoffStyles.heroIconSm}>
          <Ionicons name={secondaryIcon} size={16} color={colors.accent} />
        </View>
      </View>
      <Text style={payoffStyles.heroTitle}>{title}</Text>
      <Text style={payoffStyles.heroBody}>{body}</Text>
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
      <Text style={[chipStyles.text, selected && chipStyles.textActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  step: {
    fontSize: 13,
    fontFamily: typography.semibold,
    color: colors.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: typography.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 8,
  },
});

const payoffStyles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primaryLight,
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
    padding: 16,
    marginBottom: 20,
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
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontFamily: typography.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    fontFamily: typography.regular,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
});

const btnStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
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
    paddingVertical: 14,
    alignItems: "center",
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: { fontSize: 14, color: colors.text, fontFamily: typography.medium },
  textActive: {
    color: colors.textInverse,
    fontFamily: typography.semibold,
  },
});

const detailStyles = StyleSheet.create({
  row: {
    paddingVertical: 14,
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
});
