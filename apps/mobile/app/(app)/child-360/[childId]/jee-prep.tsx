import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

type PrepState = Awaited<ReturnType<typeof api.getChildPrep>>;

export default function ChildJeePrepScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [data, setData] = useState<PrepState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token || !childId) return;
    try {
      setData(await api.getChildPrep(token, childId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load JEE Prep");
    }
  }, [childId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openLink(mode: "self" | "share") {
    const token = await getToken();
    if (!token || !childId) return;
    const { url } = await api.createChildPrepLink(token, childId, mode);
    if (mode === "share") {
      await Share.share({ message: url });
      return;
    }
    await Linking.openURL(url);
  }

  async function revoke(grantId: string) {
    const token = await getToken();
    if (!token || !childId) return;
    await api.revokeChildPrepDevice(token, childId, grantId);
    await load();
  }

  const progress = data?.progress;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>JEE Prep</Text>
      <Text style={styles.body}>Free practice opens in the browser. This screen shows the streak after they answer while linked.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Stat label="Streak" value={progress ? `${progress.streak}d` : "—"} />
        <Stat label="Answered" value={progress ? String(progress.answeredCount) : "—"} />
        <Stat label="Accuracy" value={progress?.accuracy == null ? "—" : `${progress.accuracy}%`} />
      </View>
      <Pressable style={styles.button} onPress={() => void openLink("self")}>
        <Text style={styles.buttonText}>Open JEE Prep</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => void openLink("share")}>
        <Text style={styles.secondaryText}>Send to child</Text>
      </Pressable>
      <Text style={styles.section}>Linked devices</Text>
      {(data?.devices ?? []).filter((device) => !device.revokedAt).map((device) => (
        <View key={device.id} style={styles.device}>
          <Text style={styles.body}>{device.label || "Device"}</Text>
          <Pressable onPress={() => void revoke(device.id)}>
            <Text style={styles.revoke}>Revoke</Text>
          </Pressable>
        </View>
      ))}
      {(data?.devices ?? []).filter((device) => !device.revokedAt).length === 0 ? (
        <Text style={styles.body}>None yet.</Text>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: typography.bold, fontSize: 24, color: colors.text },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  error: { color: colors.error },
  row: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: spacing.md },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { fontFamily: typography.bold, fontSize: 22, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 999, padding: spacing.md, alignItems: "center" },
  buttonText: { color: colors.textInverse, fontFamily: typography.bold },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, padding: spacing.md, alignItems: "center" },
  secondaryText: { color: colors.text, fontFamily: typography.bold },
  section: { fontFamily: typography.bold, fontSize: 16, color: colors.text, marginTop: spacing.sm },
  device: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revoke: { color: colors.error, fontFamily: typography.bold },
});
