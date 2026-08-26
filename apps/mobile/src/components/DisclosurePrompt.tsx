import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  visible: boolean;
  level: 2 | 3;
  purpose?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function DisclosurePrompt({
  visible,
  level,
  purpose = "marketplace",
  onConfirm,
  onCancel,
  loading,
}: Props) {
  const isCarpool = level === 3 || purpose === "carpool";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {isCarpool ? (
            <>
              <Text style={styles.title}>Carpooling requires full identity</Text>
              <Text style={styles.body}>
                Anonymous carpooling is not permitted for child safety.
              </Text>
              <Text style={styles.listTitle}>You will share:</Text>
              <Text style={styles.listItem}>• Name</Text>
              <Text style={styles.listItem}>• Flat number</Text>
              <Text style={styles.listItem}>• Phone number</Text>
              <Text style={styles.listItem}>• Vehicle details</Text>
              <Text style={styles.note}>
                This cannot be undone for this arrangement.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                Share your identity with this parent?
              </Text>
              <Text style={styles.listTitle}>They will see:</Text>
              <Text style={styles.listItem}>• First name</Text>
              <Text style={styles.listItem}>• Flat number</Text>
              <Text style={styles.listTitle}>They will not see:</Text>
              <Text style={styles.listItem}>• Phone or email</Text>
              <Text style={styles.listItem}>• Your child's name</Text>
              <Text style={styles.note}>
                This applies only to this conversation and cannot be undone.
              </Text>
            </>
          )}

          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={onConfirm}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Sharing…" : "Share my details"}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onCancel}>
            <Text style={styles.secondaryBtnText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 12,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.textMuted, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
