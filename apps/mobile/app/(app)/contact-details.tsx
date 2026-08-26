import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        These details are only shared when you explicitly agree in a 1:1 chat.
        They are never shown in circles or the marketplace listing itself.
      </Text>

      <Text style={styles.label}>First name</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="e.g. Meera"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Flat / block number</Text>
      <TextInput
        style={styles.input}
        value={blockOrFlat}
        onChangeText={setBlockOrFlat}
        placeholder="e.g. C-1203"
      />

      <Text style={styles.label}>Phone (for carpool only)</Text>
      <TextInput
        style={styles.input}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder="10-digit mobile"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Vehicle (for carpool only)</Text>
      <TextInput
        style={styles.input}
        value={vehicleDescription}
        onChangeText={setVehicleDescription}
        placeholder="e.g. White Innova · KA-01-AB-1234"
      />

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save contact details</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  saveBtn: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
