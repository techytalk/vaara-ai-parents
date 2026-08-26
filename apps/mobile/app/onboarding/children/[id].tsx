import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { api, type Child, type Curriculum } from "@/lib/api";
import { getToken } from "@/lib/session";
import { GENDER_LABEL } from "@/constants/onboarding";
import {
  colors,
  DetailRow,
  OnboardingHeader,
  SecondaryButton,
} from "@/components/onboarding/ui";

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<Child | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    const [kids, currs] = await Promise.all([
      api.getChildren(token),
      api.getCurricula(),
    ]);
    const found = kids.find((c) => c.id === id);
    if (!found) {
      setError("Child not found");
      return;
    }
    setChild(found);
    setCurricula(currs);
  }, [id, router]);

  useEffect(() => {
    load()
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        load().catch(() => {});
      }
    }, [load, loading])
  );

  const curriculumFullName =
    child && curricula.length > 0
      ? curricula.find((c) => c.code === child.curriculum.code)?.name ??
        child.curriculum.name
      : child?.curriculum.name ?? "";

  function onRemove() {
    Alert.alert(
      "Remove child?",
      "This updates your circle memberships.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token || !child) return;
            setRemoving(true);
            try {
              await api.deleteChild(token, child.id);
              router.back();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to remove");
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Child not found"}</Text>
        <SecondaryButton label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnboardingHeader
        title={child.nickname?.trim() || "Child details"}
        subtitle="This information helps match you with the right parent circles."
      />

      <View style={styles.card}>
        <DetailRow
          label="Nickname"
          value={child.nickname?.trim() || "Not set"}
        />
        <DetailRow
          label="Gender"
          value={GENDER_LABEL[child.gender] ?? child.gender}
        />
        <DetailRow label="Curriculum" value={curriculumFullName} />
        <DetailRow label="Class / grade" value={child.grade.label} />
        <DetailRow label="School" value={child.school.displayLabel} />
      </View>

      <Text style={styles.privacy}>
        Other parents only see your anonymous handle plus curriculum and grade
        context in circles — never this nickname or school name.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SecondaryButton
        label="Edit child"
        onPress={() =>
          router.push({
            pathname: "/onboarding/children/edit/[id]",
            params: { id: child.id },
          })
        }
      />

      <Pressable
        style={styles.removeBtn}
        onPress={onRemove}
        disabled={removing}
      >
        <Text style={styles.removeText}>
          {removing ? "Removing…" : "Remove child"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  privacy: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 16,
  },
  error: { color: colors.error, marginBottom: 8, textAlign: "center" },
  removeBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  removeText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
});
