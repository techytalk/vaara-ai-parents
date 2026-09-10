import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CompletionPromptCandidate } from "@/lib/completion-prompts";
import { trackEvent } from "@/lib/analytics";
import { colors, radii, spacing, typography } from "@/constants/theme";

type Props = {
  prompt: CompletionPromptCandidate;
  onPress: () => void;
  onDismiss: () => void;
};

export function CompletionPrompt({ prompt, onPress, onDismiss }: Props) {
  useEffect(() => {
    trackEvent("completion_prompt_shown", { prompt: prompt.kind });
  }, [prompt.kind, prompt.key]);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={prompt.cta}
        onPress={() => {
          trackEvent("completion_prompt_tapped", { prompt: prompt.kind });
          onPress();
        }}
        style={styles.body}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.cta}>{prompt.cta}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        onPress={onDismiss}
        style={styles.dismiss}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    ...typography.supporting,
    flex: 1,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    lineHeight: 20,
  },
  dismiss: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
});
