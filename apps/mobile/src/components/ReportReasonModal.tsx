import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  OTHER_REPORT_REASON_ID,
  REPORT_REASON_OPTIONS,
  formatReportReason,
} from "@/lib/report-reasons";
import { colors, radii, spacing, typography } from "@/constants/theme";

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function ReportReasonModal({
  visible,
  title,
  description = "Choose the reason that best describes the issue. Reports are reviewed by our safety team.",
  submitting = false,
  onCancel,
  onSubmit,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setOtherDetail("");
    }
  }, [visible]);

  function handleCancel() {
    if (submitting) return;
    onCancel();
  }

  function handleSubmit() {
    if (!selectedId || submitting) return;
    const reason = formatReportReason(selectedId, otherDetail);
    if (!reason) return;
    onSubmit(reason);
  }

  const canSubmit =
    Boolean(selectedId) &&
    (selectedId !== OTHER_REPORT_REASON_ID || otherDetail.trim().length >= 10);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <ScrollView
            style={styles.reasonList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASON_OPTIONS.map((option) => {
              const selected = selectedId === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSelectedId(option.id)}
                  style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.reasonLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedId === OTHER_REPORT_REASON_ID ? (
            <TextInput
              style={styles.otherInput}
              placeholder="Describe what happened (min. 10 characters)"
              placeholderTextColor={colors.textMuted}
              value={otherDetail}
              onChangeText={setOtherDetail}
              multiline
              maxLength={500}
              editable={!submitting}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit report"
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}
            style={[
              styles.submitBtn,
              (!canSubmit || submitting) && styles.submitBtnDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit report</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel report"
            disabled={submitting}
            onPress={handleCancel}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
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
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "88%",
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  reasonList: {
    maxHeight: 280,
    marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reasonLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.medium,
    flex: 1,
  },
  otherInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    fontFamily: typography.regular,
    textAlignVertical: "top",
    marginBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    color: colors.textInverse,
    fontFamily: typography.bold,
    fontSize: 15,
  },
  cancelBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontFamily: typography.semibold,
    fontSize: 15,
  },
});
