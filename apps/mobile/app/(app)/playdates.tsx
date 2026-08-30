import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafetyNotice } from "@/components/SafetyNotice";
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Child, type PlaydateMatch } from "@/lib/api";
import { useParentSafetyActions } from "@/lib/parent-safety";
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
  const showParentSafetyActions = useParentSafetyActions();
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

  async function connect(peerUserId: string, peerHandle: string) {
    const token = await getToken();
    if (!token) return;
    const result = await api.connectPlaydate(token, peerUserId);
    router.push({
      pathname: "/(app)/messages/[conversationId]",
      params: {
        conversationId: result.conversationId,
        peerHandle: result.peer.anonymousHandle ?? peerHandle,
      },
    });
  }

  if (loading) {
    return <ScreenLoader label="Loading playdates" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafetyNotice
        tone="info"
        message="Playdates are opt-in only. You'll see anonymous handles and age bands — never a child's name, exact age, or school. Arrange meetups only after mutual identity sharing in messages."
      />

      <SectionHeader title="Opt in" />
      <Text style={styles.fieldLabel}>Child</Text>
      <View style={styles.chipRow}>
        {children.map((child) => (
          <Chip
            key={child.id}
            label={child.nickname}
            selected={selectedChild === child.id}
            onPress={() => setSelectedChild(child.id)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Age band</Text>
      <View style={styles.chipRow}>
        {AGE_BANDS.map((band) => (
          <Chip
            key={band.value}
            label={band.label}
            selected={ageBand === band.value}
            onPress={() => setAgeBand(band.value)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Matching scope</Text>
      <View style={styles.chipRow}>
        <Chip
          label="My community"
          selected={scope === "community"}
          onPress={() => setScope("community")}
        />
        <Chip
          label="My pin code"
          selected={scope === "pin"}
          onPress={() => setScope("pin")}
        />
      </View>

      <Button label="Opt in for playdates" onPress={onOptIn} style={styles.cta} />

      <SectionHeader title="Matches" />
      {!available ? (
        <EmptyState
          icon="happy-outline"
          title="No matches yet"
          message={reason ?? "Opt in above and we'll surface nearby families when enough parents are available."}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="happy-outline"
          title="Waiting for families"
          message="You're opted in. Matches appear here when other parents in your scope join."
        />
      ) : (
        matches.map((m) => (
          <View key={m.userId} style={styles.matchRow}>
            <Pressable
              style={styles.matchMain}
              onPress={() => connect(m.userId, m.anonymousHandle)}
            >
              <Avatar
                handle={m.anonymousHandle}
                avatarKey={m.avatarKey}
                size={40}
              />
              <View style={styles.matchCopy}>
                <Text style={styles.handle}>{m.anonymousHandle}</Text>
                <Text style={styles.meta}>
                  Age band {m.ageBand.replace("_", "–")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Safety actions for ${m.anonymousHandle}`}
              hitSlop={8}
              onPress={() =>
                showParentSafetyActions({
                  handle: m.anonymousHandle,
                  userId: m.userId,
                  onBlocked: () => {
                    setMatches((current) =>
                      current.filter((match) => match.userId !== m.userId)
                    );
                  },
                })
              }
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  fieldLabel: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cta: { marginTop: spacing.sm },
  matchRow: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  matchMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  matchCopy: { flex: 1 },
  handle: {
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
  },
});
