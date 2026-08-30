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
import { getToken } from "@/lib/session";
import { ChildFormFields } from "@/components/onboarding/ChildFormFields";
import {
  pickGradeForCurriculum,
  resolveChildFormState,
  sortCurricula,
} from "@/constants/onboarding";
import { parseIsoDateOnly, toIsoDateOnly } from "@/lib/dates";
import {
  colors,
  OnboardingHeader,
  PrimaryButton,
} from "@/components/onboarding/ui";

export default function EditChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        const [kids, list, loc] = await Promise.all([
          api.getChildren(t),
          api.getCurricula(),
          api.getLocation(t),
        ]);
        const child = kids.find((c) => c.id === id);
        if (!child) {
          setError("Child not found");
          return;
        }
        const sorted = sortCurricula(list);
        setCurricula(sorted);
        populateFromChild(child, sorted);
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
  }, [id, router]);

  function populateFromChild(child: Child, sortedCurricula: Curriculum[]) {
    setNickname(child.nickname);
    setDateOfBirth(
      child.dateOfBirth ? parseIsoDateOnly(child.dateOfBirth) : null
    );
    setSelectedSchool(child.school);
    setGender(child.gender);
    const resolved = resolveChildFormState(child, sortedCurricula);
    if (resolved) {
      setCurriculumId(resolved.curriculumId);
      setGradeId(resolved.gradeId);
    }
  }

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
      await api.updateChild(token, id, {
        nickname: nick,
        dateOfBirth: toIsoDateOnly(dateOfBirth),
        schoolId: selectedSchool.id,
        gender,
        curriculumId,
        gradeId,
      });
      router.replace({
        pathname: "/onboarding/children/[id]",
        params: { id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update child");
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

  if (error && !nickname) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
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
        title="Edit child"
        subtitle="Update nickname, date of birth, school, curriculum, or class. Changes update your circles."
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
        label="Save changes"
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
