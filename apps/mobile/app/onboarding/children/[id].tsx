import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { api, type Child, type Curriculum } from "@/lib/api";
import { confirmRemoveChild } from "@/lib/child360Remove";
import { getToken } from "@/lib/session";
import { getCurriculaCached } from "@/lib/reference-cache";
import { GENDER_LABEL } from "@/constants/onboarding";
import { formatChildDob } from "@/lib/dates";
import { colors, DetailRow, PrimaryButton, SecondaryButton, useOnboardingContentStyle } from "@/components/onboarding/ui";

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<Child | null>(null);
  const [childrenCount, setChildrenCount] = useState(1);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentStyle = useOnboardingContentStyle();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    const [kids, currs] = await Promise.all([
      api.getChildren(token),
      getCurriculaCached(),
    ]);
    const found = kids.find((c) => c.id === id);
    if (!found) {
      setError("Child not found");
      return;
    }
    setChild(found);
    setChildrenCount(kids.length);
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
    child && child.curriculum && curricula.length > 0
      ? curricula.find((c) => c.code === child.curriculum?.code)?.name ??
        child.curriculum.name
      : child?.curriculum?.name ?? "";

  function onRemove() {
    if (!child) return;
    confirmRemoveChild({
      child,
      remainingCount: childrenCount,
      router,
      onBusy: setRemoving,
      onError: setError,
    });
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

  const boardGrade =
    child.track === "preschool" && child.ageYears
      ? `${child.ageYears} years`
      : child.curriculum && child.grade
        ? `${child.curriculum.name} · ${child.grade.label}`
        : child.school.displayLabel;
  const openIdentity = (focus: "identity" = "identity") => {
    router.push({
      pathname: "/onboarding/children/edit/[id]",
      params: { id: child.id, focus },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, contentStyle]}>
      <Text style={styles.title}>
        {child.nickname?.trim() || boardGrade}
      </Text>
      <Text style={styles.subtitle}>
        This information helps match you with the right parent circles.
      </Text>

      <View style={styles.card}>
        <DetailRow
          label="Nickname"
          value={child.nickname?.trim() || "Add a nickname"}
          onPress={
            child.nickname?.trim()
              ? undefined
              : () => openIdentity("identity")
          }
        />
        <DetailRow
          label="Gender"
          value={GENDER_LABEL[child.gender] ?? child.gender}
        />
        <DetailRow
          label="Date of birth"
          value={
            child.dateOfBirth
              ? formatChildDob(child.dateOfBirth)
              : "Add date of birth"
          }
          onPress={
            child.dateOfBirth ? undefined : () => openIdentity("identity")
          }
        />
        <DetailRow
          label={child.track === "preschool" ? "Age" : "Curriculum"}
          value={
            child.track === "preschool" && child.ageYears
              ? `${child.ageYears} years`
              : curriculumFullName || "—"
          }
        />
        {child.track === "preschool" ? null : (
          <DetailRow
            label="Class / grade"
            value={child.grade?.label ?? "—"}
          />
        )}
        <DetailRow label="School" value={child.school.displayLabel} />
      </View>

      <Text style={styles.privacy}>
        Other parents only see your anonymous handle plus curriculum and grade
        context in circles — never this nickname, date of birth, or school name.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Go to feed"
        onPress={() => router.replace("/(app)" as never)}
      />
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
  content: {},
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 20,
  },
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
