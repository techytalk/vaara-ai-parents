import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type Child, type Curriculum, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";
import { ChildFormFields } from "@/components/onboarding/ChildFormFields";
import { sortCurricula } from "@/constants/onboarding";
import { toIsoDateOnly } from "@/lib/dates";
import {
  colors,
  OnboardingHeader,
  PrimaryButton,
} from "@/components/onboarding/ui";

export default function AddChildScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromPrompt = from === "prompt";
  const [token, setToken] = useState<string | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");

  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [gender, setGender] = useState("unspecified");
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(t);
      try {
        const [list, loc, kids] = await Promise.all([
          api.getCurricula(),
          api.getLocation(t),
          api.getChildren(t).catch(() => [] as Child[]),
        ]);
        const sorted = sortCurricula(list);
        setCurricula(sorted);
        setExistingCount(kids.length);
        if (loc) {
          setDefaultCity(loc.city ?? "");
          setDefaultPin(loc.pinCode ?? "");
          setDefaultState(loc.state ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function onSave() {
    if (!token || !curriculumId || !gradeId || !selectedSchool) return;

    setError(null);
    setSubmitting(true);
    try {
      const body: {
        nickname?: string;
        dateOfBirth?: string;
        schoolId: string;
        gender: string;
        curriculumId: string;
        gradeId: string;
      } = {
        schoolId: selectedSchool.id,
        gender,
        curriculumId,
        gradeId,
      };
      const nick = nickname.trim();
      if (nick) body.nickname = nick;
      if (dateOfBirth) body.dateOfBirth = toIsoDateOnly(dateOfBirth);

      await api.addChild(token, body);
      if (existingCount > 0) {
        trackEvent("second_child_added", {
          source: fromPrompt ? "completion_prompt" : "children_list",
        });
      }
      router.replace(fromPrompt ? "/(app)" : "/onboarding/children");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add child");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const canSave = Boolean(selectedSchool && curriculumId && gradeId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader
        title="Add a child"
        subtitle="School, board and class place you in the right circles. Nickname and date of birth are optional and stay private."
      />

      <ChildFormFields
        token={token}
        curricula={curricula}
        nickname={nickname}
        onNicknameChange={setNickname}
        dateOfBirth={dateOfBirth}
        onDateOfBirthChange={setDateOfBirth}
        selectedSchool={selectedSchool}
        onSchoolSelect={setSelectedSchool}
        gender={gender}
        onGenderChange={setGender}
        curriculumId={curriculumId}
        onCurriculumChange={(cid) => {
          setCurriculumId(cid);
          const fromCur = curricula.find((c) => c.id === curriculumId);
          const fromGrade = fromCur?.grades.find((g) => g.id === gradeId);
          const toCur = curricula.find((c) => c.id === cid);
          const same = fromGrade
            ? toCur?.grades.find((g) => g.code === fromGrade.code)
            : undefined;
          setGradeId(same?.id ?? null);
        }}
        gradeId={gradeId}
        onGradeChange={setGradeId}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
        identityOptional
        schoolFirst
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Save child"
        onPress={onSave}
        loading={submitting}
        disabled={!canSave}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: colors.error, marginBottom: 8 },
});
