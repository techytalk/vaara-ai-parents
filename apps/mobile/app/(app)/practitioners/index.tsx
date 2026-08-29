import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafetyNotice } from "@/components/SafetyNotice";
import { Chip, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
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
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const token = await getToken();
    if (!token) return;
    setList(
      await api.discoverPractitioners(token, {
        category: category || undefined,
      })
    );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [category]);

  if (loading) {
    return <ScreenLoader label="Loading local doctors" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        contentContainerStyle={
          list.length === 0 ? styles.emptyContainer : styles.list
        }
        ListHeaderComponent={
          <>
            <SafetyNotice
              tone="warning"
              message="Parent logistics only — not medical advice. Vaara does not verify clinical competence. Never share symptom or medication guidance here."
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.value || "all"}
                  label={c.label}
                  selected={category === c.value}
                  onPress={() => setCategory(c.value)}
                />
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="medkit-outline"
            title="No recommendations yet"
            message="Parents in your pin code can add logistics notes about local doctors and clinics."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.recommendationCount} parent recommendations`}
            onPress={() =>
              router.push({
                pathname: "/(app)/practitioners/[id]",
                params: { id: item.id },
              })
            }
          >
            <View style={styles.iconWrap}>
              <Ionicons name="medkit-outline" size={20} color={colors.teal} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.category} · {item.recommendationCount} parent
                {item.recommendationCount !== 1 ? "s" : ""} recommended
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  emptyContainer: { flexGrow: 1, padding: spacing.lg },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.teal}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  name: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  meta: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
