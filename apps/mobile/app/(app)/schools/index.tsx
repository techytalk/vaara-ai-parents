import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { api, type School } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function SchoolsBrowseScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      setResults(await api.searchSchools(token, { q }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Browse school profiles, parent-reported fees, and reviews — even before
        you join a school circle.
      </Text>
      <TextInput
        style={styles.search}
        placeholder="Search schools by name…"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={search}
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.length >= 2 ? (
              <Text style={styles.empty}>No schools found.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/(app)/schools/[id]",
                  params: { id: item.id },
                })
              }
            >
              <Text style={styles.name}>{item.displayLabel}</Text>
              {item.verified ? (
                <Text style={styles.verified}>Verified listing</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hint: { padding: 16, color: colors.textMuted, lineHeight: 20, fontSize: 14 },
  search: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
  },
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
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  verified: { fontSize: 12, color: colors.primary, marginTop: 4 },
});
