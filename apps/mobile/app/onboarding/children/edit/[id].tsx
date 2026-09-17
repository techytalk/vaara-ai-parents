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
import { invalidateFamilyMeta } from "@/lib/authenticated-state";
import { getToken } from "@/lib/session";
import { getCurriculaCached } from "@/lib/reference-cache";
import { ChildFormFields } from "@/components/onboarding/ChildFormFields";
import {
  pickGradeForCurriculum,
  resolveChildFormState,
  sortCurricula,
} from "@/constants/onboarding";
import { isPlaceholderSchool } from "@/constants/circles";
import { parseIsoDateOnly, toIsoDateOnly } from "@/lib/dates";
import {
  Chip,
  colors,
  PrimaryButton,
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";

export default function EditChildScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentStyle = useOnboardingContentStyle();
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");

  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [gender, setGender] = useState("unspecified");
  const [track, setTrack] = useState<"school" | "preschool">("school");
  const [ageYears, setAgeYears] = useState<3 | 4 | null>(null);
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
          getCurriculaCached(),
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
    setNickname(child.nickname ?? "");
    setDateOfBirth(
      child.dateOfBirth ? parseIsoDateOnly(child.dateOfBirth) : null
    );
    // The placeholder school is not a valid choice — the API rejects it. Leave
    // the picker empty so it offers nearby schools and Save stays disabled
    // until a real one is chosen.
    setSelectedSchool(isPlaceholderSchool(child.school) ? null : child.school);
    setGender(child.gender);
    setTrack(child.track === "preschool" ? "preschool" : "school");
    setAgeYears(
      child.ageYears === 3 || child.ageYears === 4 ? child.ageYears : null
    );
    const resolved = resolveChildFormState(child, sortedCurricula);
    if (resolved) {
      setCurriculumId(resolved.curriculumId);
      setGradeId(resolved.gradeId);
    } else {
      setCurriculumId(null);
      setGradeId(null);
    }
  }

  async function onSave() {
    if (!token || !selectedSchool || !gender) return;
    if (track === "preschool" && ageYears !== 3 && ageYears !== 4) return;
    if (track === "school" && (!curriculumId || !gradeId)) return;

    setError(null);
    setSubmitting(true);
    try {
      const body: {
        nickname?: string | null;
        dateOfBirth?: string | null;
        schoolId: string;
        gender: string;
        track: "school" | "preschool";
        ageYears?: number | null;
        curriculumId?: string | null;
        gradeId?: string | null;
      } = {
        schoolId: selectedSchool.id,
        gender,
        track,
      };
      if (track === "preschool") {
        body.ageYears = ageYears;
        body.curriculumId = null;
        body.gradeId = null;
      } else {
        body.curriculumId = curriculumId;
        body.gradeId = gradeId;
        body.ageYears = null;
      }
      const nick = nickname.trim();
      body.nickname = nick || null;
      body.dateOfBirth = dateOfBirth ? toIsoDateOnly(dateOfBirth) : null;

      await api.updateChild(token, id, body);
      invalidateFamilyMeta();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: "/onboarding/children/[id]",
          params: { id },
        });
      }
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

  if (error && !selectedSchool && !loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const canSave =
    track === "preschool"
      ? Boolean(selectedSchool && gender && (ageYears === 3 || ageYears === 4))
      : Boolean(selectedSchool && gender && gradeId && curriculumId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Edit child</Text>
      <Text style={styles.subtitle}>
        {track === "preschool"
          ? "Update preschool campus or age anytime. Nickname and date of birth are optional and stay private."
          : "Update school, board or class anytime. Nickname and date of birth are optional and stay private."}
      </Text>

      {track === "preschool" ? (
        <View style={styles.ageRow}>
          <Text style={styles.ageLabel}>Age circle</Text>
          <View style={styles.chipRow}>
            {([3, 4] as const).map((years) => (
              <Chip
                key={years}
                label={`${years} years`}
                selected={ageYears === years}
                onPress={() => setAgeYears(years)}
              />
            ))}
          </View>
        </View>
      ) : null}

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
        identityOptional
        schoolFirst={focus !== "identity"}
        showBoardAndClass={track !== "preschool"}
        list={
          track === "preschool"
            ? selectedSchool?.kind === "school"
              ? "preschool_campus"
              : "preschool"
            : "school"
        }
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
    marginBottom: 14,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: colors.error, marginBottom: 8 },
  ageRow: { marginBottom: 12 },
  ageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
