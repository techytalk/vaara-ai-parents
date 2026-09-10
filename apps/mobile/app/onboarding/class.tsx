import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Curriculum, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import { getOnboardingSchool } from "@/lib/onboarding-draft";
import {
  curriculumChipLabel,
  isLimitedCurriculum,
  sortCurricula,
} from "@/constants/onboarding";
import {
  Chip,
  colors,
  FieldLabel,
  InfoCard,
  OnboardingPayoff,
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function OnboardingClassScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const drafted = getOnboardingSchool();
    if (!drafted) {
      router.replace("/onboarding/school" as never);
      return;
    }
    setSchool(drafted);

    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
        const list = sortCurricula(await api.getCurricula());
        setCurricula(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load boards");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const selectedCurriculum = curricula.find((c) => c.id === curriculumId);

  async function onFinish() {
    if (!token || !school || !curriculumId || !gradeId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.addChild(token, {
        schoolId: school.id,
        curriculumId,
        gradeId,
        gender: "unspecified",
      });
      const me = await api.me(token);
      const stored = await getStoredUser();
      if (stored) {
        await saveSession(token, { ...stored, ...me });
      }
      trackEvent("onboarding_class_complete");
      router.replace("/onboarding/ready" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finish setup");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const boardName = selectedCurriculum?.name ?? selectedCurriculum?.code;
  const canContinue = Boolean(curriculumId && gradeId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.step}>Step 3 of 3</Text>
      <OnboardingPayoff
        primaryIcon="library"
        secondaryIcon="people"
        title="Place you with the right parents"
        body="Pick the board and class so we can put you in the same circle as parents whose children study the same way."
      />
      <Text style={styles.formTitle}>Board and class</Text>

      <FieldLabel>Board</FieldLabel>
      <View style={styles.chipRow}>
        {curricula.map((item) => (
          <Chip
            key={item.id}
            label={curriculumChipLabel(item)}
            selected={curriculumId === item.id}
            onPress={() => {
              setCurriculumId(item.id);
              setGradeId(null);
            }}
          />
        ))}
      </View>
      {boardName ? (
        <Text style={styles.valueLine}>
          Connect with {boardName} parents across India.
        </Text>
      ) : (
        <Text style={styles.hint}>Pick a board first.</Text>
      )}

      {selectedCurriculum ? (
        <>
          {isLimitedCurriculum(selectedCurriculum) ? (
            <InfoCard>
              {selectedCurriculum.name} only includes early years classes
              (up to about grade 5). Select a K–12 board such as CBSE or SSC
              for classes 6–12.
            </InfoCard>
          ) : null}

          <FieldLabel>Class</FieldLabel>
          <View style={styles.gradeGrid}>
            {selectedCurriculum.grades.map((grade) => (
              <Chip
                key={grade.id}
                label={grade.label}
                selected={gradeId === grade.id}
                onPress={() => setGradeId(grade.id)}
              />
            ))}
          </View>
          {gradeId && school ? (
            <Text style={styles.valueLine}>
              Get into the circle of your child&apos;s class parents at{" "}
              {school.displayLabel}.
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>Class options appear after you pick a board.</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Enter Vaara"
        onPress={onFinish}
        loading={submitting}
        disabled={!canContinue}
      />
      <SecondaryButton
        label="Back"
        onPress={() => router.replace("/onboarding/school" as never)}
      />
      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  step: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  gradeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  valueLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
    marginBottom: 16,
  },
  error: { color: colors.error, marginBottom: 8 },
});
