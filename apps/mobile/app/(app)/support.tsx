import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.faqItem}>
      <Text style={styles.faqQuestion}>{question}</Text>
      <Text style={styles.faqAnswer}>{answer}</Text>
    </View>
  );
}

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

export default function SupportScreen() {
  const router = useRouter();
  const appVersion = getAppVersion();

  function openSupportEmail() {
    const body = encodeURIComponent(
      `Vaara Parents ${appVersion} (${Platform.OS})\n\nDescribe your question:\n`
    );
    const subject = encodeURIComponent("Vaara Parents support");
    Linking.openURL(`mailto:support@vaara.ai?subject=${subject}&body=${body}`).catch(
      () => {}
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Email support</Text>
        <Text style={styles.cardBody}>
          For account help, privacy questions, or community safety concerns,
          contact our team. Your email will include app version and platform
          only — never child data, messages, or access tokens.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Email support at support@vaara.ai"
          onPress={openSupportEmail}
          style={({ pressed }) => [
            styles.emailButton,
            pressed && styles.emailButtonPressed,
          ]}
        >
          <Ionicons name="mail-outline" size={18} color={colors.textInverse} />
          <Text style={styles.emailButtonText}>support@vaara.ai</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Privacy and safety</Text>
      <Text style={styles.bodyText}>
        Your anonymous handle is shown in circles. Real names and contact
        details are shared only when both parents agree in a direct
        conversation. You can block a parent from a connection request or chat
        to stop future contact.
      </Text>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="settings-outline"
          label="Settings & Privacy"
          onPress={() => router.push("/(app)/settings" as never)}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notification Preferences"
          onPress={() => router.push("/(app)/settings/notifications" as never)}
        />
      </View>

      <Text style={styles.sectionTitle}>Frequently asked questions</Text>
      <View style={styles.faqGroup}>
        <FaqItem
          question="How do I report a parent or post?"
          answer="Open the ⋯ menu on a post, conversation, or connection request, choose Report, then pick a reason before submitting. You can also report parents from carpool and playdate screens."
        />
        <FaqItem
          question="Why can't I see another parent's name?"
          answer="Vaara keeps parent identity anonymous until both sides agree to share contact details in a private chat."
        />
        <FaqItem
          question="How do I turn off notifications?"
          answer="Open Notification Preferences from Settings or below to control each category and quiet hours."
        />
      </View>

      <View style={styles.noticeCard}>
        <Ionicons name="warning-outline" size={20} color={colors.amber} />
        <Text style={styles.noticeText}>
          Vaara is not an emergency service. If anyone is in immediate danger,
          contact local emergency services.
        </Text>
      </View>

      <Text style={styles.versionText}>
        Vaara Parents version {appVersion} ({Platform.OS})
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: spacing.xs,
  },
  cardBody: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emailButtonPressed: { opacity: 0.9 },
  emailButtonText: {
    ...typography.body,
    color: colors.textInverse,
    fontFamily: typography.semibold,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: spacing.xs,
  },
  bodyText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  menuGroup: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
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
  faqGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  faqItem: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  faqQuestion: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
    marginBottom: 4,
  },
  faqAnswer: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.medium,
    flex: 1,
    lineHeight: 20,
  },
  versionText: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.regular,
    textAlign: "center",
  },
});
