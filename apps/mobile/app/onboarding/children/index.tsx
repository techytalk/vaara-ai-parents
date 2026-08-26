import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api, type Child } from "@/lib/api";
import { getToken } from "@/lib/session";
import { GENDER_LABEL } from "@/constants/onboarding";
import {
  colors,
  InfoCard,
  OnboardingHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function ChildrenListScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const kids = await api.getChildren(token);
      setChildren(kids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load children");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
  }

  function onContinue() {
    if (children.length === 0) {
      setError("Add at least one child to continue");
      return;
    }
    router.push("/onboarding/location");
  }

  if (loading && children.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={children}
        keyExtractor={(item) => item.id}
        extraData={children.length}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <OnboardingHeader
              step={1}
              totalSteps={2}
              title="Your children"
              subtitle="Add each child's curriculum and class. This places you in the right parent circles — from nursery through 12th."
            />
            <InfoCard>
              We never show your child's name in circles. Only curriculum and
              grade context appear alongside your anonymous handle.
            </InfoCard>
            {children.length > 0 ? (
              <Text style={styles.listTitle}>
                {children.length} child{children.length === 1 ? "" : "ren"} added
              </Text>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No children yet</Text>
                <Text style={styles.emptyBody}>
                  Tap below to add your first child.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/onboarding/children/[id]",
                params: { id: item.id },
              })
            }
          >
            <View style={styles.cardIcon}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {item.nickname?.trim() || "Child"}
              </Text>
              <Text style={styles.cardMeta}>
                {item.curriculum.name} · {item.grade.label}
              </Text>
              <Text style={styles.cardSub}>
                {GENDER_LABEL[item.gender] ?? item.gender}
                {item.school ? ` · ${item.school.displayLabel}` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SecondaryButton
              label="+ Add another child"
              onPress={() => router.push("/onboarding/children/add")}
            />
            <PrimaryButton
              label="Continue to location"
              onPress={onContinue}
              disabled={children.length === 0}
            />
            <SignOutButton />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  cardMeta: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 2,
    fontWeight: "500",
  },
  cardSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  footer: { marginTop: 8 },
  error: { color: colors.error, marginBottom: 8, textAlign: "center" },
});
