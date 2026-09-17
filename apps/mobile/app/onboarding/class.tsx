import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type Curriculum, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken, saveSession } from "@/lib/session";
import {
  getOnboardingClassSelection,
  getOnboardingSchool,
  hydrateOnboardingDraft,
  setOnboardingChildren,
  setOnboardingCircles,
  setOnboardingClassSelection,
  setOnboardingUser,
  setOnboardingStep,
  ensureOnboardingAttemptId,
} from "@/lib/onboarding-draft";
import { getCurriculaCached } from "@/lib/reference-cache";
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
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";
import { OnboardingAccountSwitch } from "@/components/SignOutButton";

const hookAccent = {
  color: colors.primary,
  textDecorationLine: "underline" as const,
  textDecorationColor: colors.primaryLight,
};

const BOARD_BLURBS: Record<string, string> = {
  CBSE:
    "Central Board of Secondary Education — India’s most common K–12 board, with a structured national curriculum.",
  SSC: "State secondary curriculum — follows your state board pattern for school and exams.",
  ICSE:
    "ICSE — a detailed English-medium curriculum with strong emphasis on language and project work.",
  IGCSE:
    "Cambridge IGCSE — an international curriculum focused on subject depth and flexible subject choices.",
  IB_PYP:
    "IB Primary Years Programme (PYP) — inquiry-based learning for early years through about Grade 5.",
  IB_MYP:
    "IB Middle Years Programme (MYP) — a globally recognized curriculum for Grades 6–10, focused on inquiry, critical thinking and real-world learning.",
  IBDP:
    "IB Diploma Programme — a rigorous pre-university curriculum typically for Grades 11–12.",
};

function boardBlurb(curriculum: Curriculum): string {
  return (
    BOARD_BLURBS[curriculum.code] ??
    `${curriculum.name} — connect with parents whose children follow this board.`
  );
}

function classHook(): { title: ReactNode; body?: string } {
  return {
    title: (
      <>
        Connect with Parents, whose children are in the{" "}
        <Text style={hookAccent}>same grade</Text> and follow the{" "}
        <Text style={hookAccent}>same curriculum</Text>.
      </>
    ),
  };
}

function showBoardHelp() {
  Alert.alert(
    "Not sure which board?",
    "Pick the curriculum your child’s school follows — CBSE, SSC, ICSE, IGCSE, or IB. If you’re unsure, check the school website or ask the school office. You can change this later.",
    [{ text: "Got it" }]
  );
}

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
  const contentStyle = useOnboardingContentStyle();

  useEffect(() => {
    setOnboardingStep("class");
    trackEvent("onboarding_class_view");
    hydrateOnboardingDraft().then(() => {
      const drafted = getOnboardingSchool();
      if (!drafted?.id) {
        router.replace("/onboarding/school" as never);
        return;
      }
      setSchool(drafted);
      const saved = getOnboardingClassSelection();
      if (saved.curriculumId) setCurriculumId(saved.curriculumId);
      if (saved.gradeId) setGradeId(saved.gradeId);

      getToken().then(async (t) => {
        if (!t) {
          router.replace("/(auth)/login");
          return;
        }
        setToken(t);
        try {
          const list = sortCurricula(await getCurriculaCached());
          setCurricula(list);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load boards");
        } finally {
          setLoading(false);
        }
      });
    });
  }, [router]);

  const selectedCurriculum = curricula.find((c) => c.id === curriculumId);
  const selectedGrade = selectedCurriculum?.grades.find((g) => g.id === gradeId);
  const boardName = selectedCurriculum?.name ?? selectedCurriculum?.code ?? null;
  const gradeLabel = selectedGrade?.label ?? null;
  const hook = classHook();
  const canContinue = Boolean(curriculumId && gradeId);
  const heroArt = boardName
    ? require("../../assets/illustrations/onboarding-class-parents-who-get-it.png")
    : require("../../assets/illustrations/onboarding-class-same-questions.png");

  async function onFinish() {
    if (!token || !school || !curriculumId || !gradeId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.addChild(
        token,
        {
          schoolId: school.id,
          curriculumId,
          gradeId,
          gender: "unspecified",
          onboardingAttemptId: ensureOnboardingAttemptId(),
        },
        { idempotencyKey: ensureOnboardingAttemptId() }
      );
      await saveSession(token, result.user);
      setOnboardingUser(result.user);
      setOnboardingCircles(result.circles);
      setOnboardingChildren([result.child]);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingPayoff
        compact
        title={hook.title}
        body={hook.body}
        illustration={heroArt}
      />

      <View style={styles.sectionHead}>
        <FieldLabel>Select Board</FieldLabel>
        <Pressable
          accessibilityRole="button"
          onPress={showBoardHelp}
          style={styles.helpLink}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.helpText}>Not sure which board?</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {curricula.map((item) => (
          <Chip
            key={item.id}
            label={curriculumChipLabel(item)}
            selected={curriculumId === item.id}
            onPress={() => {
              setCurriculumId(item.id);
              setGradeId(null);
              setOnboardingClassSelection({
                curriculumId: item.id,
                gradeId: null,
              });
            }}
          />
        ))}
      </View>

      {selectedCurriculum ? (
        <View style={styles.boardCard}>
          <Image
            source={require("../../assets/illustrations/board-grad-cap-badge.png")}
            style={styles.boardCardArt}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.boardCardText}>
            {boardBlurb(selectedCurriculum)}
          </Text>
        </View>
      ) : (
        <Text style={styles.hint}>Pick a board first.</Text>
      )}

      {selectedCurriculum ? (
        <>
          {isLimitedCurriculum(selectedCurriculum) ? (
            <InfoCard>
              {selectedCurriculum.name} only includes early years classes (up to
              about grade 5). Select a K–12 board such as CBSE or SSC for
              classes 6–12.
            </InfoCard>
          ) : null}

          <FieldLabel>Select Class</FieldLabel>
          <View style={styles.gradeGrid}>
            {selectedCurriculum.grades.map((grade) => (
              <Chip
                key={grade.id}
                label={grade.label}
                selected={gradeId === grade.id}
                onPress={() => {
                  setGradeId(grade.id);
                  setOnboardingClassSelection({
                    curriculumId,
                    gradeId: grade.id,
                  });
                }}
              />
            ))}
          </View>

          {gradeId && school && gradeLabel ? (
            <View style={styles.joinCard}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.joinText}>
                You&apos;re joining the{" "}
                <Text style={styles.joinAccent}>{gradeLabel}</Text> parent
                circle at{" "}
                <Text style={styles.joinAccent}>{school.displayLabel}</Text>.
              </Text>
            </View>
          ) : (
            <Text style={styles.hint}>Pick a class to continue.</Text>
          )}
        </>
      ) : (
        <Text style={styles.hint}>
          Class options appear after you pick a board.
        </Text>
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
      <OnboardingAccountSwitch step="class" />

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
        <Text style={styles.privacyText}>
          Your child&apos;s academic information is only used to connect you
          with relevant parent circles. It is never shared publicly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {},
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  helpText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  gradeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  boardCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 12,
    marginBottom: 14,
  },
  boardCardArt: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  boardCardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.primaryDark,
  },
  joinCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 12,
    marginBottom: 14,
  },
  joinText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  joinAccent: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  error: { color: colors.error, marginBottom: 8 },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
