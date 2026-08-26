import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

          <Pressable style={styles.primaryButton} onPress={onUpdate}>
            <Text style={styles.primaryButtonText}>Update</Text>
          </Pressable>

          {!forced ? (
            <Pressable style={styles.secondaryButton} onPress={onDismiss}>
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </Pressable>
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
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e4ef",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5c5c7a",
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#5c5c7a",
    fontSize: 15,
    fontWeight: "500",
  },
});
