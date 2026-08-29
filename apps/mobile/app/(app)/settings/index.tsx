import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FEATURE_FLAGS } from "@/constants/features";
import { colors, radii, spacing, typography } from "@/constants/theme";

type MenuIcon = keyof typeof Ionicons.glyphMap;

function MenuRow({
  icon,
  label,
  onPress,
  color = colors.primary,
}: {
  icon: MenuIcon;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.menuRowPressed,
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Vaara keeps your parent identity anonymous in circles. Child identity is
        never disclosed. Contact details are shared only when both parents agree
        in a conversation, and blocking prevents future contact without deleting
        moderation or disclosure audit records.
      </Text>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="people-outline"
          label="My Children"
          onPress={() => router.push("/onboarding/children")}
        />
        <MenuRow
          icon="location-outline"
          label="Location & community"
          onPress={() => router.push("/onboarding/location")}
        />
        <MenuRow
          icon="id-card-outline"
          label="Contact details for mutual handover"
          onPress={() => router.push("/(app)/contact-details")}
        />
        <MenuRow
          icon="pricetags-outline"
          label="Interest topics"
          color={colors.lavender}
          onPress={() => router.push("/(app)/topics")}
        />
        <MenuRow
          icon="calendar-outline"
          label="School calendar"
          onPress={() => router.push("/(app)/calendar")}
        />
        {FEATURE_FLAGS.showPlaydates ? (
          <MenuRow
            icon="happy-outline"
            label="Playdates"
            onPress={() => router.push("/(app)/playdates")}
          />
        ) : null}
        {FEATURE_FLAGS.showCarpool ? (
          <MenuRow
            icon="car-outline"
            label="Carpool"
            onPress={() => router.push("/(app)/carpool")}
          />
        ) : null}
      </View>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="notifications-outline"
          label="Notification Preferences"
          onPress={() => router.push("/(app)/settings/notifications" as never)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  menuGroup: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  menuRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowPressed: { backgroundColor: colors.surfaceMuted },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    flex: 1,
  },
});
