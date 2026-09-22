import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { api, type Curriculum, type School } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { invalidateFamilyMeta } from "@/lib/authenticated-state";
import { getToken, saveSession } from "@/lib/session";
import { getCurriculaCached } from "@/lib/reference-cache";
import { ChildFormFields } from "@/components/onboarding/ChildFormFields";
import { sortCurricula } from "@/constants/onboarding";
import { toIsoDateOnly } from "@/lib/dates";
import { colors, PrimaryButton, useOnboardingContentStyle } from "@/components/onboarding/ui";
import { useChildren, useLocation } from "@/hooks/useSessionQueries";

function leaveAddChildScreen(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/onboarding/children" as never);
}

export default function AddChildScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromPrompt = from === "prompt";
  const [token, setToken] = useState<string | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPin, setDefaultPin] = useState("");
  const [defaultState, setDefaultState] = useState("");
  const contentStyle = useOnboardingContentStyle();
  const locationQuery = useLocation();
  const childrenQuery = useChildren();
  const existingCount = childrenQuery.data?.length ?? 0;

  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [gender, setGender] = useState("");
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => leaveAddChildScreen(router)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerBack}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  useEffect(() => {
    let cancelled = false;
    getToken().then(async (t) => {
      if (!t) {
        router.replace("/(auth)/login");
        return;
      }
      if (cancelled) return;
      setToken(t);
      try {
        const list = await getCurriculaCached();
        if (cancelled) return;
        setCurricula(sortCurricula(list));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const loc = locationQuery.data;
    if (!loc) return;
    setDefaultCity(loc.city ?? "");
    setDefaultPin(loc.pinCode ?? "");
    setDefaultState(loc.state ?? "");
  }, [locationQuery.data]);

  async function onSave() {
    if (!token || !curriculumId || !gradeId || !selectedSchool || !gender) return;

    setError(null);
    setSubmitting(true);
    try {
      const body: {
        nickname?: string;
        dateOfBirth?: string;
        track: "school";
        schoolId: string;
        gender: string;
        curriculumId: string;
        gradeId: string;
      } = {
        track: "school",
        schoolId: selectedSchool.id,
        gender,
        curriculumId,
        gradeId,
      };
      const nick = nickname.trim();
      if (nick) body.nickname = nick;
      if (dateOfBirth) body.dateOfBirth = toIsoDateOnly(dateOfBirth);

      const result = await api.addChild(token, body);
      await saveSession(token, result.user);
      invalidateFamilyMeta({ user: result.user });
      if (existingCount > 0) {
        trackEvent("second_child_added", {
          source: fromPrompt ? "completion_prompt" : "children_list",
        });
      }
      if (fromPrompt) {
        router.replace("/(app)" as never);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/onboarding/children" as never);
      }
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

  const canSave = Boolean(selectedSchool && gender && curriculumId && gradeId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Add a child</Text>
      <Text style={styles.subtitle}>
        School, gender, board and class are required so we can place you in
        the right circles. Nickname and date of birth are optional and stay
        private.
      </Text>

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
  headerBack: { marginLeft: 4, paddingRight: 4 },
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
});
