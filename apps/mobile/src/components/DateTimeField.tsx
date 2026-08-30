import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Button } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";

function parseTime(value: string): Date {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  const date = new Date();
  date.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  hint,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? new Date());

  function openPicker() {
    setDraft(value ?? new Date());
    setOpen(true);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) {
        onChange(date);
      }
      return;
    }
    if (date) setDraft(date);
  }

  function confirmIos() {
    onChange(draft);
    setOpen(false);
  }

  const display = value
    ? value.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Select date of birth";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        onPress={openPicker}
        style={styles.field}
      >
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !value && styles.placeholder]}>
          {display}
        </Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      ) : null}

      {open && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={onPickerChange}
            />
            <Button label="Done" onPress={confirmIos} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseTime(value));

  function openPicker() {
    setDraft(parseTime(value));
    setOpen(true);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) {
        onChange(formatTime(date));
      }
      return;
    }
    if (date) setDraft(date);
  }

  function confirmIos() {
    onChange(formatTime(draft));
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        onPress={openPicker}
        style={styles.field}
      >
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="time"
          is24Hour
          display="default"
          onChange={onPickerChange}
        />
      ) : null}

      {open && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="time"
              is24Hour
              display="spinner"
              onChange={onPickerChange}
            />
            <Button label="Done" onPress={confirmIos} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? new Date());

  function openPicker() {
    setDraft(value ?? new Date());
    setOpen(true);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) {
        onChange(date);
      }
      return;
    }
    if (date) setDraft(date);
  }

  function confirmIos() {
    onChange(draft);
    setOpen(false);
  }

  const display = value
    ? value.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Select date and time";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        onPress={openPicker}
        style={styles.field}
      >
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !value && styles.placeholder]}>
          {display}
        </Text>
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="datetime"
          display="default"
          onChange={onPickerChange}
        />
      ) : null}

      {open && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="datetime"
              display="spinner"
              onChange={onPickerChange}
            />
            <Button label="Done" onPress={confirmIos} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xs,
    minHeight: 44,
    justifyContent: "center",
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginBottom: 2,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.medium,
  },
  placeholder: { color: colors.textSubtle },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  sheetTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    textAlign: "center",
  },
});
