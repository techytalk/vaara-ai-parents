import {
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";

type Props = {
  visible: boolean;
  forced: boolean;
  latestVersion?: string;
  onUpdate: () => void;
  onDismiss: () => void;
};

export function UpdatePrompt({
  visible,
  forced,
  latestVersion,
  onUpdate,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={forced ? undefined : onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.body}>
            A new version of Vaara Parents is available
            {latestVersion ? ` (${latestVersion})` : ""}. Update now for the
            latest features and fixes.
          </Text>

          <Button label="Update" onPress={onUpdate} />

          {!forced ? (
            <Button
              label="Not now"
              variant="ghost"
              onPress={onDismiss}
              style={styles.secondary}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  body: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.xs,
  },
  secondary: { marginTop: spacing.xs },
});
