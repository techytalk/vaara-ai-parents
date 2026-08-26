import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type CarpoolOffer } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function CarpoolScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<CarpoolOffer[]>([]);
  const [departureTime, setDepartureTime] = useState("08:00");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      setMatches(await api.getCarpoolMatches(token));
      setLoading(false);
    });
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
      setMatches(await api.getCarpoolMatches(token));
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.disclaimer}>
        Vaara introduces parents and records the arrangement. It does not vet
        drivers, verify licences, insure rides, or track vehicles. Full identity
        (level 3) is required before a carpool can go active.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Departure time (HH:MM)</Text>
        <TextInput
          style={styles.input}
          value={departureTime}
          onChangeText={setDepartureTime}
        />
        <Pressable style={styles.btn} onPress={createOffer}>
          <Text style={styles.btnText}>Offer a school run</Text>
        </Pressable>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No matching offers at your school and locality yet.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => startArrangement(item)}>
            <Text style={styles.handle}>{item.ownerHandle}</Text>
            <Text style={styles.meta}>
              {item.role} · {item.direction} · {item.departureTime}
            </Text>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            <Text style={styles.tapHint}>Tap to start an arrangement</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  disclaimer: {
    padding: 16,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    backgroundColor: "#fee2e2",
  },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  input: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
  },
  btn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  list: { padding: 16 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: { fontWeight: "600", color: colors.primary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  notes: { fontSize: 14, marginTop: 6, color: colors.text },
  tapHint: { fontSize: 12, color: colors.primary, marginTop: 8, fontWeight: "600" },
});
