import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  avatarPalette,
  colors,
  radii,
  shadows,
  spacing,
  typography,
} from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, style]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "coral";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const foreground =
    variant === "primary" || variant === "coral"
      ? colors.textInverse
      : variant === "secondary"
        ? colors.primaryDark
        : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} color={foreground} size={19} /> : null}
          <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>
  );
}

export function SearchField(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={19} color={colors.textMuted} />
      <TextInput
        {...props}
        style={[styles.searchInput, props.style]}
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
      />
    </View>
  );
}

export function Avatar({
  handle,
  size = 42,
}: {
  handle: string;
  size?: number;
}) {
  let hash = 0;
  for (let index = 0; index < handle.length; index += 1) {
    hash = (hash * 31 + handle.charCodeAt(index)) | 0;
  }
  const backgroundColor =
    avatarPalette[Math.abs(hash) % avatarPalette.length] ?? colors.teal;
  const initials = handle
    .split(/[-\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <View
      accessibilityLabel={`${handle} avatar`}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.3 }]}>
        {initials || "P"}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon = "people-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={25} color={colors.primaryDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScreenLoader({ label = "Loading" }: { label?: string }) {
  return (
    <View style={styles.loader} accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loaderText}>{label}</Text>
    </View>
  );
}

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: "transparent" },
  coral: { backgroundColor: colors.coral },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  button: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  buttonText: {
    fontFamily: typography.semibold,
    fontSize: 15,
  },
  pressed: { opacity: Platform.OS === "ios" ? 0.72 : 0.8 },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  sectionAction: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.medium,
  },
  chipTextSelected: { color: colors.textInverse },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: colors.text,
    fontFamily: typography.regular,
    fontSize: 15,
  },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: {
    color: colors.textInverse,
    fontFamily: typography.bold,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    textAlign: "center",
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  emptyButton: { marginTop: spacing.md, minWidth: 160 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.errorSoft,
  },
  errorText: {
    ...typography.supporting,
    flex: 1,
    color: colors.error,
    fontFamily: typography.medium,
  },
  retryText: {
    ...typography.supporting,
    color: colors.error,
    fontFamily: typography.bold,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loaderText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
});
