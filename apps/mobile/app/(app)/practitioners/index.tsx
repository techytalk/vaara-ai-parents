import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type Practitioner } from "@/lib/api";
import { getToken } from "@/lib/session";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "pediatrician", label: "Pediatrician" },
  { value: "dentist", label: "Dentist" },
  { value: "therapist", label: "Therapist" },
  { value: "optometrist", label: "Optometrist" },
];

export default function PractitionersScreen() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [list, setList] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        setList(
          await api.discoverPractitioners(token, {
            category: category || undefined,
          })
        );
      } finally {
        setLoading(false);
      }
    });
  }, [category]);

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
        Parent logistics only — not medical advice. Vaara does not verify clinical
        competence.
      </Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.value || "all"}
            style={[styles.chip, category === c.value && styles.chipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text
              style={[
                styles.chipText,
                category === c.value && styles.chipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No recommendations in your pin code yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/(app)/practitioners/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.category} · {item.recommendationCount} parent
              {item.recommendationCount !== 1 ? "s" : ""} recommended
            </Text>
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
    backgroundColor: "#fef3c7",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  list: { padding: 16 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 24 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
