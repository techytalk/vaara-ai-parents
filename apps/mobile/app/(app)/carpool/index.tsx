import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafetyNotice } from "@/components/SafetyNotice";
import {
  Avatar,
  Button,
  EmptyState,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type CarpoolOffer } from "@/lib/api";
import { showParentSafetyActions } from "@/lib/parent-safety";
import { getToken } from "@/lib/session";

export default function CarpoolScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<CarpoolOffer[]>([]);
  const [departureTime, setDepartureTime] = useState("08:00");
  const [loading, setLoading] = useState(true);

  async function loadMatches() {
    const token = await getToken();
    if (!token) return;
    setMatches(await api.getCarpoolMatches(token));
  }

  useEffect(() => {
    loadMatches().finally(() => setLoading(false));
  }, []);

  async function createOffer() {
    try {
      const token = await getToken();
      if (!token) return;
      await api.createCarpoolOffer(token, {
        role: "driver",
        direction: "to_school",
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime,
        seats: 2,
      });
      await loadMatches();
      Alert.alert("Posted", "Your carpool offer is visible to nearby parents.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not post");
    }
  }

  async function startArrangement(offer: CarpoolOffer) {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.createCarpoolArrangement(token, {
        daysOfWeek: offer.daysOfWeek,
        departureTime: offer.departureTime,
        offerIds: [offer.id],
      });
      router.push({
        pathname: "/(app)/carpool/arrangement/[id]",
        params: { id: result.id },
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not start");
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading carpool matches" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <SafetyNotice
              tone="critical"
              message="Vaara introduces parents and records the arrangement. It does not vet drivers, verify licences, insure rides, or track vehicles. Level 3 identity disclosure is required before a carpool can go active."
            />
            <SectionHeader title="Offer a school run" />
            <Text style={styles.fieldLabel}>Departure time (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={departureTime}
              onChangeText={setDepartureTime}
              accessibilityLabel="Departure time"
            />
            <Button
              label="Post carpool offer"
              onPress={createOffer}
              style={styles.cta}
            />
            <SectionHeader title="Nearby offers" />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No matching offers"
            message="Parents at your school and locality will appear here when they post a compatible run."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.cardMain}
              onPress={() => startArrangement(item)}
            >
              <Avatar handle={item.ownerHandle} size={40} />
              <View style={styles.cardCopy}>
                <Text style={styles.handle}>{item.ownerHandle}</Text>
                <Text style={styles.meta}>
                  {item.role} · {item.direction} · {item.departureTime}
                </Text>
                {item.notes ? (
                  <Text style={styles.notes}>{item.notes}</Text>
                ) : null}
                <Text style={styles.tapHint}>Tap to start an arrangement</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Safety actions for ${item.ownerHandle}`}
              hitSlop={8}
              onPress={() =>
                showParentSafetyActions({
                  handle: item.ownerHandle,
                  userId: item.ownerUserId,
                  onBlocked: () => {
                    setMatches((current) =>
                      current.filter((offer) => offer.id !== item.id)
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
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  fieldLabel: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...typography.body,
    color: colors.text,
    fontFamily: typography.regular,
  },
  cta: { marginTop: spacing.sm, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardMain: { flex: 1, flexDirection: "row", gap: spacing.sm },
  cardCopy: { flex: 1 },
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
    textTransform: "capitalize",
  },
  notes: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  tapHint: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: typography.semibold,
    marginTop: spacing.xs,
  },
});
