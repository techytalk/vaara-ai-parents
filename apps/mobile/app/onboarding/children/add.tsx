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
import { getToken } from "@/lib/session";
import { ChildFormFields } from "@/components/onboarding/ChildFormFields";
import { pickDefaultCurriculum, pickGradeForCurriculum, sortCurricula } from "@/constants/onboarding";
import { defaultChildDob, toIsoDateOnly } from "@/lib/dates";
import {
  colors,
  OnboardingHeader,
  PrimaryButton,
} from "@/components/onboarding/ui";

export default function AddChildScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");

  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(defaultChildDob());
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
        const [list, loc] = await Promise.all([
          api.getCurricula(),
          api.getLocation(t),
        ]);
        const sorted = sortCurricula(list);
        setCurricula(sorted);
        const defaultCur = pickDefaultCurriculum(sorted);
        if (defaultCur) {
          setCurriculumId(defaultCur.id);
          setGradeId(defaultCur.grades[0]?.id ?? null);
        }
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
    const nick = nickname.trim();
    if (!nick) {
      setError("Nickname is required");
      return;
    }
    if (!dateOfBirth) {
      setError("Date of birth is required");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.addChild(token, {
        nickname: nick,
        dateOfBirth: toIsoDateOnly(dateOfBirth),
        schoolId: selectedSchool.id,
        gender,
        curriculumId,
        gradeId,
      });
      router.replace("/onboarding/children");
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

  const canSave =
    nickname.trim().length > 0 && dateOfBirth && selectedSchool && gradeId;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader
        title="Add a child"
        subtitle="Nickname, date of birth, and school are required. All stay private in circles."
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
          setGradeId(
            pickGradeForCurriculum(curricula, curriculumId, gradeId, cid)
          );
        }}
        gradeId={gradeId}
        onGradeChange={setGradeId}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
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
