import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DisclosurePrompt } from "@/components/DisclosurePrompt";
import { SafetyNotice } from "@/components/SafetyNotice";
import {
  Avatar,
  Button,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, peerDisplayName, type CarpoolArrangement } from "@/lib/api";
import { showParentSafetyActions } from "@/lib/parent-safety";
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
    return <ScreenLoader label="Loading carpool arrangement" />;
  }

  const showActivate =
    arrangement.status === "forming" &&
    allConfirmed &&
    arrangement.participants.length >= 2;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SafetyNotice tone="critical" message={arrangement.disclaimer} />
        <Text style={styles.meta}>
          Status: {arrangement.status} · {arrangement.departureTime}
        </Text>

        <SectionHeader title="Participants" />
        {arrangement.participants.map((p) => (
          <View key={p.userId} style={styles.participantRow}>
            <Avatar
              handle={p.peerView ? peerDisplayName(p.peerView) : p.handle}
              size={40}
            />
            <View style={styles.participantCopy}>
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
            {p.userId !== myUserId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Safety actions for ${p.handle}`}
                hitSlop={8}
                onPress={() =>
                  showParentSafetyActions({
                    handle: p.handle,
                    userId: p.userId,
                    onBlocked: () => router.back(),
                  })
                }
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        ))}

        {arrangement.status !== "active" && !myConfirmed ? (
          <Button
            label="Confirm my identity (level 3)"
            onPress={() => setPromptVisible(true)}
            style={styles.action}
          />
        ) : null}

        {showActivate ? (
          <Button
            label={activating ? "Activating…" : "Activate carpool"}
            onPress={onActivate}
            loading={activating}
            style={styles.action}
          />
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textTransform: "capitalize",
  },
  participantRow: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  participantCopy: { flex: 1 },
  handle: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  participantMeta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
    textTransform: "capitalize",
  },
  contact: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
  },
  action: { marginTop: spacing.sm },
  leaveBtn: {
    marginTop: spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveText: {
    ...typography.body,
    color: colors.error,
    fontFamily: typography.semibold,
  },
});
