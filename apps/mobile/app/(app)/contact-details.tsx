import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafetyNotice } from "@/components/SafetyNotice";
import { Button, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ContactDetailsScreen() {
  const [firstName, setFirstName] = useState("");
  const [blockOrFlat, setBlockOrFlat] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const details = await api.getContactDetails(token);
        if (details) {
          setFirstName(details.firstName ?? "");
          setBlockOrFlat(details.blockOrFlat ?? "");
          setContactPhone(details.contactPhone ?? "");
          setVehicleDescription(details.vehicleDescription ?? "");
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.updateContactDetails(token, {
        firstName: firstName.trim(),
        blockOrFlat: blockOrFlat.trim(),
        contactPhone: contactPhone.trim(),
        vehicleDescription: vehicleDescription.trim(),
      });
      Alert.alert("Saved", "Your contact details are stored securely on your account.");
    } catch (e) {
      Alert.alert(
        "Could not save",
        e instanceof Error ? e.message : "Please try again"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading contact details" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafetyNotice
        tone="info"
        message="These details are only shared when you explicitly agree in a 1:1 chat. They are never shown in circles or marketplace listings."
      />

      <Text style={styles.label}>First name</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="e.g. Meera"
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="words"
        accessibilityLabel="First name"
      />

      <Text style={styles.label}>Flat / block number</Text>
      <TextInput
        style={styles.input}
        value={blockOrFlat}
        onChangeText={setBlockOrFlat}
        placeholder="e.g. C-1203"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Flat or block number"
      />

      <Text style={styles.label}>Phone (for carpool only)</Text>
      <TextInput
        style={styles.input}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder="10-digit mobile"
        placeholderTextColor={colors.textSubtle}
        keyboardType="phone-pad"
        accessibilityLabel="Contact phone"
      />

      <Text style={styles.label}>Vehicle (for carpool only)</Text>
      <TextInput
        style={styles.input}
        value={vehicleDescription}
        onChangeText={setVehicleDescription}
        placeholder="e.g. White Innova · KA-01-AB-1234"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Vehicle description"
      />

      <Button
        label="Save contact details"
        onPress={onSave}
        loading={saving}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xs },
  label: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
    minHeight: 44,
  },
  cta: { marginTop: spacing.lg },
});
