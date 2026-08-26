import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type Child, type PlaydateMatch } from "@/lib/api";
import { getToken } from "@/lib/session";

const AGE_BANDS = [
  { value: "0_2", label: "0–2" },
  { value: "2_4", label: "2–4" },
  { value: "4_6", label: "4–6" },
  { value: "6_8", label: "6–8" },
  { value: "8_12", label: "8–12" },
  { value: "12_plus", label: "12+" },
];

export default function PlaydatesScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [ageBand, setAgeBand] = useState("4_6");
  const [scope, setScope] = useState<"community" | "pin">("community");
  const [matches, setMatches] = useState<PlaydateMatch[]>([]);
  const [available, setAvailable] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = await getToken();
    if (!token) return;
    const result = await api.getPlaydateMatches(token);
    setAvailable(result.available);
    setReason(result.reason ?? null);
    setMatches(result.matches ?? []);
  }

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      setChildren(await api.getChildren(token));
      await refresh();
      setLoading(false);
    });
  }, []);

  async function onOptIn() {
    if (!selectedChild) {
      Alert.alert("Choose a child", "Select which child to opt in.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    await api.optInPlaydate(token, {
      childId: selectedChild,
      ageBand,
      scope,
    });
    await refresh();
    Alert.alert("Opted in", "We'll show matches when enough families are nearby.");
  }

  async function connect(peerUserId: string) {
    const token = await getToken();
    if (!token) return;
    const result = await api.connectPlaydate(token, peerUserId);
    router.push({
      pathname: "/(app)/messages/[conversationId]",
      params: {
        conversationId: result.conversationId,
        peerHandle: result.peer.anonymousHandle,
      },
    });
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
      <Text style={styles.disclaimer}>
        Playdates are opt-in only. You'll only see anonymous handles and age bands
        — never a child's name or school. Share first name and flat in chat before
        meeting.
      </Text>

      <Text style={styles.label}>Child</Text>
      {children.map((child) => (
        <Pressable
          key={child.id}
          style={[
            styles.chip,
            selectedChild === child.id && styles.chipActive,
          ]}
          onPress={() => setSelectedChild(child.id)}
        >
          <Text
            style={[
              styles.chipText,
              selectedChild === child.id && styles.chipTextActive,
            ]}
          >
            {child.nickname}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Age band</Text>
      <View style={styles.row}>
        {AGE_BANDS.map((band) => (
          <Pressable
            key={band.value}
            style={[styles.chip, ageBand === band.value && styles.chipActive]}
            onPress={() => setAgeBand(band.value)}
          >
            <Text
              style={[
                styles.chipText,
                ageBand === band.value && styles.chipTextActive,
              ]}
            >
              {band.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.btn} onPress={onOptIn}>
        <Text style={styles.btnText}>Opt in for playdates</Text>
      </Pressable>

      {!available ? (
        <Text style={styles.meta}>{reason ?? "No matches yet"}</Text>
      ) : (
        <>
          <Text style={styles.section}>Matches ({matches.length})</Text>
          {matches.map((m) => (
            <Pressable
              key={m.userId}
              style={styles.matchRow}
              onPress={() => connect(m.userId)}
            >
              <Text style={styles.handle}>{m.anonymousHandle}</Text>
              <Text style={styles.meta}>Age band {m.ageBand.replace("_", "–")}</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  disclaimer: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  label: { marginTop: 16, fontWeight: "600", color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  meta: { marginTop: 16, color: colors.textMuted, lineHeight: 20 },
  section: { marginTop: 24, fontWeight: "700", fontSize: 16 },
  matchRow: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: { fontWeight: "600", color: colors.primary },
});
