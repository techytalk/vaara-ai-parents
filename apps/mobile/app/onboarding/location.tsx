import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type PlaceSuggestion, type ResolvedPlace } from "@/lib/api";
import { onboardingGeoParams, trackEvent } from "@/lib/analytics";
import { invalidateFamilyMeta } from "@/lib/authenticated-state";
import { getStoredUser, getToken, saveSession } from "@/lib/session";
import {
  ensureOnboardingAttemptId,
  getOnboardingAgeYears,
  getOnboardingClassSelection,
  getOnboardingPlace,
  getOnboardingSchool,
  getOnboardingTrack,
  hydrateOnboardingDraft,
  setOnboardingChildren,
  setOnboardingCircles,
  setOnboardingLocationAsync,
  setOnboardingPlace,
  setOnboardingStep,
  setOnboardingUser,
} from "@/lib/onboarding-draft";
import {
  colors,
  FieldInput,
  OnboardingPayoff,
  PrimaryButton,
  SecondaryButton,
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";
import { OnboardingAccountSwitch } from "@/components/SignOutButton";

function sessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function sameCity(left?: string | null, right?: string | null): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  if (!a || !b) return true;
  if (a === b) return true;
  const metro = new Set(["hyderabad", "secunderabad"]);
  return metro.has(a) && metro.has(b);
}

export default function LocationScreen() {
  const router = useRouter();
  const contentStyle = useOnboardingContentStyle();
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [attribution, setAttribution] = useState(false);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<ResolvedPlace | null>(null);
  const [buildingToken, setBuildingToken] = useState<string | null>(null);
  const [cityConfirmed, setCityConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placesSession = useRef(sessionToken());
  const requestId = useRef(0);
  const schoolCity = useRef("");

  useEffect(() => {
    setOnboardingStep("location");
    trackEvent("location_screen_view");
    getToken().then(async (next) => {
      if (!next) {
        router.replace("/(auth)/login");
        return;
      }
      setToken(next);
      const stored = await getStoredUser();
      const complete = Boolean(stored?.onboardingComplete);
      setEditing(complete);
      if (!complete) trackEvent("onboarding_location_view");
      await hydrateOnboardingDraft();
      schoolCity.current = getOnboardingSchool()?.city ?? "";
      const saved = getOnboardingPlace();
      if (saved.token && saved.title) {
        setPicked({
          placeSelectionToken: saved.token,
          needsArea: false,
          title: saved.title,
          subtitle: saved.subtitle ?? "",
          city: saved.city,
          communityName: saved.communityName,
          source: saved.source === "postal" ? "postal" : "places",
        });
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!token || picked) return;
    const q = query.trim();
    const digits = q.replace(/\D/g, "");
    if (q.length < 3 && digits.length !== 6) {
      setResults([]);
      setAttribution(false);
      return;
    }
    const current = ++requestId.current;
    const handle = setTimeout(() => {
      setSearching(true);
      api
        .searchPlaces(token, {
          q,
          city: schoolCity.current || undefined,
          sessionToken: placesSession.current,
        })
        .then((payload) => {
          if (current !== requestId.current) return;
          setResults(payload.results);
          setAttribution(payload.attribution);
          if (payload.sessionToken) placesSession.current = payload.sessionToken;
        })
        .catch(() => {
          if (current === requestId.current) setResults([]);
        })
        .finally(() => {
          if (current === requestId.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, token, picked]);

  async function choose(item: PlaceSuggestion) {
    if (!token) return;
    setError(null);
    setSearching(true);
    try {
      const resolved = await api.resolvePlace(token, {
        id: item.id,
        source: item.source,
        sessionToken: placesSession.current,
        buildingToken: buildingToken ?? undefined,
      });
      trackEvent("area_selected", { source: item.source });
      if (resolved.needsArea) {
        setBuildingToken(resolved.buildingToken ?? null);
        setPicked(null);
        setQuery("");
        setResults([]);
        placesSession.current = sessionToken();
        return;
      }
      setPicked(resolved);
      setCityConfirmed(false);
      setOnboardingPlace({
        token: resolved.placeSelectionToken ?? null,
        title: resolved.title,
        subtitle: resolved.subtitle,
        source: resolved.source,
        city: resolved.city ?? null,
        communityName: resolved.communityName ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that place");
    } finally {
      setSearching(false);
    }
  }

  function changePlace() {
    setPicked(null);
    setBuildingToken(null);
    setCityConfirmed(false);
    setQuery("");
    setResults([]);
    placesSession.current = sessionToken();
    setOnboardingPlace({
      token: null,
      title: null,
      subtitle: null,
      source: null,
      city: null,
      communityName: null,
    });
  }

  const school = getOnboardingSchool();
  const cityDiffers =
    Boolean(picked?.city) && !sameCity(picked?.city, school?.city ?? schoolCity.current);
  const canContinue = Boolean(picked?.placeSelectionToken) && (!cityDiffers || cityConfirmed);

  async function onContinue() {
    if (!token || !picked?.placeSelectionToken) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        const location = await api.updateLocation(token, {
          placeSelectionToken: picked.placeSelectionToken,
        });
        await setOnboardingLocationAsync(location, { loaded: true });
        invalidateFamilyMeta();
        trackEvent("location_updated", { source: picked.source });
        router.replace("/(app)");
        return;
      }

      const track = getOnboardingTrack() === "preschool" ? "preschool" : "school";
      const klass = getOnboardingClassSelection();
      const ageYears = getOnboardingAgeYears();
      if (!school?.id) {
        router.replace("/onboarding/school" as never);
        return;
      }
      const result = await api.finalizeOnboarding(token, {
        onboardingAttemptId: ensureOnboardingAttemptId(),
        placeSelectionToken: picked.placeSelectionToken,
        track,
        schoolId: school.id,
        curriculumId: klass.curriculumId ?? undefined,
        gradeId: klass.gradeId ?? undefined,
        ageYears: ageYears === 3 || ageYears === 4 ? ageYears : undefined,
      });
      await saveSession(token, result.user);
      setOnboardingUser(result.user);
      setOnboardingChildren([result.child]);
      setOnboardingCircles(result.circles);
      await setOnboardingLocationAsync(result.location, { loaded: true });
      trackEvent("onboarding_location_complete", { source: picked.source });
      trackEvent(
        "onboarding_geo",
        onboardingGeoParams({
          phase: "location",
          countryCode: result.location.countryCode,
          enteredCity: result.location.city,
          enteredState: result.location.state,
          pinCode: result.location.pinCode,
          schoolCity: school.city,
          schoolState: school.state,
          schoolPin: school.pinCode,
          source: picked.source,
          hasCommunity: Boolean(result.location.communityName),
        })
      );
      router.replace("/onboarding/ready" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save where you live");
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

  const empty =
    query.trim().length >= 3 && !searching && results.length === 0 && !picked;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingPayoff
        compact
        title="Where do you live now?"
        body={
          buildingToken
            ? "Choose the area around that building."
            : "Search your apartment or area. This is where you live now, not your hometown."
        }
        illustration={require("../../assets/illustrations/onboarding-location-near-you.png")}
      />

      {picked ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>{picked.title}</Text>
          <Text style={styles.confirmBody}>{picked.subtitle}</Text>
          <Pressable onPress={changePlace}>
            <Text style={styles.change}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FieldInput
            label={buildingToken ? "Choose your area" : "Where do you live now?"}
            value={query}
            onChangeText={setQuery}
            placeholder={buildingToken ? "Gachibowli, Kondapur" : "Apartment or area"}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {searching ? <ActivityIndicator color={colors.primary} /> : null}
          {results.map((item) => (
            <Pressable key={`${item.source}:${item.id}`} style={styles.row} onPress={() => choose(item)}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.rowBody}>{item.subtitle}</Text> : null}
            </Pressable>
          ))}
          {empty ? (
            <Text style={styles.empty}>
              No area matches “{query.trim()}”. Type the area you live in. Example: Gachibowli, Kondapur.
            </Text>
          ) : null}
          {attribution ? <Text style={styles.attribution}>Powered by Google</Text> : null}
        </>
      )}

      {cityDiffers && picked && !cityConfirmed ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Your school is in {school?.city ?? schoolCity.current}. Nearby parents use where you live now.
          </Text>
          <SecondaryButton
            label={`Use an area in ${school?.city ?? "your school city"}`}
            onPress={changePlace}
          />
          <SecondaryButton
            label={`My child lives in ${picked.city}`}
            onPress={() => setCityConfirmed(true)}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={submitting ? "Saving…" : "Continue"}
        onPress={onContinue}
        disabled={!canContinue || submitting}
      />
      {!editing ? (
        <SecondaryButton
          label="Back"
          onPress={() =>
            router.replace(
              (getOnboardingTrack() === "preschool"
                ? "/onboarding/age"
                : "/onboarding/class") as never
            )
          }
        />
      ) : null}
      {!editing ? <OnboardingAccountSwitch step="location" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.bg,
  },
  rowTitle: { color: colors.text, fontSize: 16 },
  rowBody: { color: colors.textMuted, marginTop: 2 },
  confirm: {
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  confirmTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  confirmBody: { color: colors.textMuted },
  change: { color: colors.primary, marginTop: 8 },
  empty: { color: colors.textMuted, lineHeight: 20 },
  attribution: { color: colors.textSubtle, fontSize: 12 },
  notice: { gap: 8 },
  noticeText: { color: colors.text, lineHeight: 20 },
  error: { color: colors.error },
});
