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
import {
  Chip,
  colors,
  PrimaryButton,
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";
import { useChildren, useLocation, useSessionUser } from "@/hooks/useSessionQueries";

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
  const fromChild360 = from === "child360";
  const fromLastRemoved = from === "last_child_removed";
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
  const sessionUser = useSessionUser();
  const existingCount = childrenQuery.data?.length ?? 0;
  const onboardingComplete = Boolean(
    sessionUser.data?.onboardingComplete
  );

  const [track, setTrack] = useState<"school" | "preschool" | null>(null);
  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [gender, setGender] = useState("");
  const [ageYears, setAgeYears] = useState<3 | 4 | null>(null);
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: fromChild360 ? "Add child" : "Add child",
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
  }, [navigation, router, fromChild360]);

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
    if (!token || !selectedSchool || !gender || !track) return;
    if (track === "preschool" && ageYears !== 3 && ageYears !== 4) return;
    if (track === "school" && (!curriculumId || !gradeId)) return;

    setError(null);
    setSubmitting(true);
    try {
      const body: {
        nickname?: string;
        dateOfBirth?: string;
        track: "school" | "preschool";
        schoolId: string;
        gender: string;
        ageYears?: number;
        curriculumId?: string;
        gradeId?: string;
      } = {
        track,
        schoolId: selectedSchool.id,
        gender,
      };
      if (track === "preschool") {
        body.ageYears = ageYears!;
      } else {
        body.curriculumId = curriculumId!;
        body.gradeId = gradeId!;
      }
      const nick = nickname.trim();
      if (nick) body.nickname = nick;
      if (dateOfBirth) body.dateOfBirth = toIsoDateOnly(dateOfBirth);

      const result = await api.addChild(token, body);
      await saveSession(token, result.user);
      invalidateFamilyMeta({ user: result.user });
      if (existingCount > 0) {
        trackEvent("second_child_added", {
          source: fromPrompt
            ? "completion_prompt"
            : fromLastRemoved
              ? "last_child_removed"
              : fromChild360
                ? "child360"
                : "children_list",
        });
      }

      const childId = result.child.id;
      if (fromPrompt) {
        router.replace("/(app)" as never);
      } else if (fromLastRemoved) {
        const hasLoc = Boolean(locationQuery.data?.pinCode);
        if (!hasLoc) {
          router.replace("/onboarding/location" as never);
        } else {
          router.replace({
            pathname: "/(app)/child-360/[childId]",
            params: { childId },
          } as never);
        }
      } else if (onboardingComplete || fromChild360) {
        router.replace({
          pathname: "/(app)/child-360/[childId]",
          params: { childId },
        } as never);
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

  if (!track) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, contentStyle]}
      >
        <Text style={styles.title}>Who are you adding?</Text>
        <Text style={styles.subtitle}>
          Preschool for ages 3–4, or a school-age child with board and class.
        </Text>
        <Pressable
          onPress={() => setTrack("preschool")}
          style={({ pressed }) => [styles.trackCard, pressed && styles.pressed]}
        >
          <Text style={styles.trackTitle}>Preschool · 3–4 years</Text>
          <Text style={styles.trackBody}>Campus and age circle</Text>
        </Pressable>
        <Pressable
          onPress={() => setTrack("school")}
          style={({ pressed }) => [styles.trackCard, pressed && styles.pressed]}
        >
          <Text style={styles.trackTitle}>School-age child</Text>
          <Text style={styles.trackBody}>School, board and class</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const canSave =
    track === "preschool"
      ? Boolean(selectedSchool && gender && (ageYears === 3 || ageYears === 4))
      : Boolean(selectedSchool && gender && curriculumId && gradeId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => setTrack(null)} hitSlop={8}>
        <Text style={styles.changeTrack}>
          ← {track === "preschool" ? "Preschool" : "School-age"} · change
        </Text>
      </Pressable>

      <Text style={styles.title}>Add a child</Text>
      <Text style={styles.subtitle}>
        {track === "preschool"
          ? "Campus, age and gender are required. Nickname and date of birth are optional and stay private."
          : "School, gender, board and class are required so we can place you in the right circles. Nickname and date of birth are optional and stay private."}
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
  trackCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  pressed: { opacity: 0.9 },
  trackTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  trackBody: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  changeTrack: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 12,
  },
  ageRow: { marginBottom: 12 },
  ageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
