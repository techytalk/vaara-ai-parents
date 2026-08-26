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
import { colors } from "@/constants/theme";

export { colors };

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

export function InfoCard({ children }: { children: string }) {
  return (
    <View style={infoStyles.card}>
      <Text style={infoStyles.text}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
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
        placeholderTextColor="#94a3b8"
        {...props}
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
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: 8,
  },
});

const infoStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: "#3730a3",
  },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
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
  text: { fontSize: 14, color: colors.text },
  textActive: { color: "#fff", fontWeight: "600" },
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
