import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DisclosurePrompt } from "@/components/DisclosurePrompt";
import { colors } from "@/constants/theme";
import { api, peerDisplayName, type CarpoolArrangement } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function CarpoolArrangementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [arrangement, setArrangement] = useState<CarpoolArrangement | null>(
    null
  );
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptVisible, setPromptVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activating, setActivating] = useState(false);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const me = await api.me(token);
    setMyUserId(me.id);
    setArrangement(await api.getCarpoolArrangement(token, id));
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const allConfirmed =
    arrangement?.participants.every((p) => p.disclosureConfirmed) ?? false;
  const myParticipant = arrangement?.participants.find(
    (p) => p.userId === myUserId
  );
  const myConfirmed = Boolean(myParticipant?.disclosureConfirmed);

  async function onConfirmDisclosure() {
    setConfirming(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.confirmCarpoolDisclosure(token, id);
      setPromptVisible(false);
      await refresh();
      Alert.alert("Confirmed", "Your full identity is shared with this carpool.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not confirm";
      if (message.includes("contact details")) {
        Alert.alert("Add contact details first", message, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => router.push("/(app)/contact-details"),
          },
        ]);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setConfirming(false);
    }
  }

  async function onActivate() {
    setActivating(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.activateCarpool(token, id);
      await refresh();
      Alert.alert("Active", "Your carpool is now active.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not activate");
    } finally {
      setActivating(false);
    }
  }

  async function onLeave() {
    Alert.alert("Leave carpool?", "Other parents will be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await api.leaveCarpool(token, id);
          router.back();
        },
      },
    ]);
  }

  if (loading || !arrangement) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const showActivate =
    arrangement.status === "forming" &&
    allConfirmed &&
    arrangement.participants.length >= 2;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.disclaimer}>{arrangement.disclaimer}</Text>
        <Text style={styles.meta}>
          Status: {arrangement.status} · {arrangement.departureTime}
        </Text>

        <Text style={styles.section}>Participants</Text>
        {arrangement.participants.map((p) => (
          <View key={p.userId} style={styles.participantRow}>
            <Text style={styles.handle}>
              {p.peerView ? peerDisplayName(p.peerView) : p.handle}
            </Text>
            <Text style={styles.participantMeta}>
              {p.role}
              {p.disclosureConfirmed ? " · identity confirmed" : " · pending"}
            </Text>
            {p.peerView?.contactPhone ? (
              <Text style={styles.contact}>
                {p.peerView.contactPhone}
                {p.peerView.vehicleDescription
                  ? ` · ${p.peerView.vehicleDescription}`
                  : ""}
              </Text>
            ) : null}
          </View>
        ))}

        {arrangement.status !== "active" && !myConfirmed ? (
          <Pressable
            style={styles.btn}
            onPress={() => setPromptVisible(true)}
          >
            <Text style={styles.btnText}>Confirm my identity (level 3)</Text>
          </Pressable>
        ) : null}

        {showActivate ? (
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={onActivate}
            disabled={activating}
          >
            <Text style={styles.btnText}>
              {activating ? "Activating…" : "Activate carpool"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.leaveBtn} onPress={onLeave}>
          <Text style={styles.leaveText}>Leave arrangement</Text>
        </Pressable>
      </ScrollView>

      <DisclosurePrompt
        visible={promptVisible}
        level={3}
        purpose="carpool"
        loading={confirming}
        onConfirm={onConfirmDisclosure}
        onCancel={() => setPromptVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  disclaimer: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 10,
  },
  meta: { marginTop: 12, color: colors.textMuted, fontSize: 14 },
  section: { marginTop: 20, fontWeight: "700", fontSize: 16 },
  participantRow: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: { fontWeight: "600", color: colors.primary },
  participantMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  contact: { fontSize: 13, marginTop: 6, color: colors.text },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondary: { backgroundColor: "#059669" },
  btnText: { color: "#fff", fontWeight: "700" },
  leaveBtn: { marginTop: 16, paddingVertical: 12, alignItems: "center" },
  leaveText: { color: "#b91c1c", fontWeight: "600" },
});
