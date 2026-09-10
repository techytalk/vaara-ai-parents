import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type PostalCountry } from "@/lib/api";
import { trackEvent, trackOnboardingBegin } from "@/lib/analytics";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import {
  getOnboardingLocation,
  setOnboardingLocation,
} from "@/lib/onboarding-draft";
import { getPostalCountriesCached } from "@/lib/reference-cache";
import {
  Chip,
  colors,
  FieldInput,
  FieldLabel,
  OnboardingPayoff,
  PrimaryButton,
} from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";

const FEATURED_COUNTRY_CODES = ["IN", "US", "GB", "CA", "AU", "SG", "AE", "DE"];

function isReadyForLookup(country: PostalCountry | null, postalCode: string): boolean {
  const value = postalCode.trim();
  if (!country || !value) return false;
  if (country.code === "IN") return /^\d{6}$/.test(value);
  if (country.code === "US") return /^\d{5}/.test(value);
  if (country.code === "AU") return /^\d{4}$/.test(value);
  return value.length >= 3;
}

function countryLabel(country: PostalCountry) {
  return country.code === "IN" ? "India" : country.name;
}

export default function LocationScreen() {
  const router = useRouter();
  const [countries, setCountries] = useState<PostalCountry[]>([]);
  const [countryCode, setCountryCode] = useState("IN");
  const [countryOpen, setCountryOpen] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [localityOptions, setLocalityOptions] = useState<string[]>([]);
  const [communitySuggestions, setCommunitySuggestions] = useState<string[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const beganRef = useRef(false);
  const lookupRequestRef = useRef(0);
  const skipNextLookupRef = useRef(false);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === countryCode) ?? null,
    [countries, countryCode]
  );

  const sortedCountries = useMemo(() => {
    const featured = FEATURED_COUNTRY_CODES.map((code) =>
      countries.find((country) => country.code === code)
    ).filter((country): country is PostalCountry => Boolean(country));
    const featuredCodes = new Set(featured.map((country) => country.code));
    const rest = countries
      .filter((country) => !featuredCodes.has(country.code))
      .sort((a, b) => a.name.localeCompare(b.name));
    return featured.length > 0 ? [...featured, ...rest] : countries;
  }, [countries]);

  const pinReady = isReadyForLookup(selectedCountry, pinCode);
  const showAreaFields = pinReady;
  const canContinue = pinReady && locality.trim().length > 0;

  useEffect(() => {
    Promise.all([
      getPostalCountriesCached().catch(() => [] as PostalCountry[]),
      getToken(),
      getStoredUser(),
    ]).then(async ([countryList, token, stored]) => {
      setCountries(countryList);
      setAlreadyComplete(Boolean(stored?.onboardingComplete));
      if (!token) {
        setPrefillLoading(false);
        return;
      }
      try {
        const drafted = getOnboardingLocation();
        const loc = drafted.locationLoaded
          ? drafted.location
          : await api.getLocation(token);
        if (!drafted.locationLoaded) {
          setOnboardingLocation(loc, { loaded: true });
        }
        if (loc) {
          skipNextLookupRef.current = true;
          setCountryCode(loc.countryCode ?? "IN");
          setPinCode(loc.pinCode);
          setLocality(loc.locality ?? "");
          setCity(loc.city ?? "");
          setState(loc.state ?? "");
          setCommunityName(loc.communityName ?? "");
        }
      } finally {
        setPrefillLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!alreadyComplete && !beganRef.current && !prefillLoading) {
      beganRef.current = true;
      trackOnboardingBegin();
    }
  }, [alreadyComplete, prefillLoading]);

  useEffect(() => {
    const postal = pinCode.trim();
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }

    if (!selectedCountry?.lookupSupported || !isReadyForLookup(selectedCountry, postal)) {
      setLocalityOptions([]);
      setCommunitySuggestions([]);
      setLookupError(null);
      return;
    }

    const requestId = ++lookupRequestRef.current;
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      setLookupError(null);
      try {
        const lookup = await api.lookupPostalCode(countryCode, postal);
        if (requestId !== lookupRequestRef.current) return;

        setCity(lookup.city);
        setState(lookup.state);
        setLocalityOptions(lookup.localities.map((item) => item.name));
        setCommunitySuggestions(lookup.communities);
        setLocality((current) => {
          if (lookup.localities.length === 1) {
            return lookup.localities[0].name;
          }
          if (
            current &&
            lookup.localities.some((item) => item.name === current)
          ) {
            return current;
          }
          return "";
        });
      } catch (e) {
        if (requestId !== lookupRequestRef.current) return;
        setLocalityOptions([]);
        setCommunitySuggestions([]);
        setLookupError(
          e instanceof Error
            ? e.message
            : `Could not look up this ${selectedCountry?.postalLabel.toLowerCase() ?? "postal code"}`
        );
      } finally {
        if (requestId === lookupRequestRef.current) {
          setLookupLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [pinCode, countryCode, selectedCountry]);

  function resetArea() {
    setLocality("");
    setCity("");
    setState("");
    setLocalityOptions([]);
    setCommunitySuggestions([]);
    setLookupError(null);
  }

  function selectCountry(code: string) {
    if (code !== countryCode) {
      setPinCode("");
      resetArea();
    }
    setCountryCode(code);
    setCountryOpen(false);
  }

  async function onFinish() {
    const postal = pinCode.trim();
    if (!postal) {
      setError(`${selectedCountry?.postalLabel ?? "Postal code"} is required`);
      return;
    }
    if (!locality.trim()) {
      setError("Select your locality / area to continue");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const result = await api.updateLocation(token, {
        countryCode,
        pinCode: postal,
        locality: locality.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        communityName: alreadyComplete
          ? communityName.trim() || undefined
          : undefined,
      });

      setOnboardingLocation(
        {
          countryCode: result.countryCode,
          pinCode: result.pinCode,
          postalCode: result.postalCode,
          locality: result.locality,
          city: result.city,
          state: result.state,
          communityName: result.communityName,
          communityKey: result.communityKey,
        },
        { loaded: true }
      );

      const storedUser = await getStoredUser();
      if (storedUser) {
        await saveSession(token, {
          ...storedUser,
          onboardingComplete: result.onboardingComplete ?? storedUser.onboardingComplete,
        });
      }

      if (alreadyComplete) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(app)");
        }
        return;
      }

      trackEvent("onboarding_location_complete");
      router.replace("/onboarding/school" as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save location");
    } finally {
      setLoading(false);
    }
  }

  if (prefillLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const postalLabel = selectedCountry?.postalLabel ?? "Postal code";
  const postalPlaceholder = selectedCountry?.placeholder ?? "Enter postal code";
  const usesNumericPostal =
    countryCode === "IN" ||
    countryCode === "US" ||
    countryCode === "AU" ||
    countryCode === "SG";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {alreadyComplete ? null : (
        <Text style={styles.step}>Step 1 of 3</Text>
      )}

      <OnboardingPayoff
        primaryIcon="people"
        secondaryIcon="home"
        title="Connect with parents in your neighbourhood"
        body="We use your PIN to find nearby parents — never your street address."
      />

      <Text style={styles.formTitle}>Where do you live?</Text>

      <FieldLabel>Country</FieldLabel>
      <Pressable
        style={styles.dropdown}
        onPress={() => setCountryOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose country"
      >
        <Text style={styles.dropdownText}>
          {selectedCountry ? countryLabel(selectedCountry) : "Select country"}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <FieldInput
        label={postalLabel}
        placeholder={postalPlaceholder}
        keyboardType={usesNumericPostal ? "number-pad" : "default"}
        autoCapitalize={usesNumericPostal ? "none" : "characters"}
        value={pinCode}
        onChangeText={(value) => {
          const next = usesNumericPostal
            ? value.replace(/\D/g, "")
            : value.toUpperCase();
          setPinCode(next);
          if (!isReadyForLookup(selectedCountry, next)) {
            resetArea();
          }
        }}
      />

      {!pinReady && selectedCountry ? (
        <Text style={styles.pinHint}>
          Enter your {postalLabel.toLowerCase()} to see your area.
        </Text>
      ) : null}

      {showAreaFields ? (
        <View>
          {!selectedCountry?.lookupSupported ? (
            <Text style={styles.manualHint}>
              Postal lookup isn&apos;t available for this country yet. Enter your
              locality, city and state.
            </Text>
          ) : null}

          {lookupLoading ? (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.lookupText}>
                Looking up {postalLabel.toLowerCase()}…
              </Text>
            </View>
          ) : null}

          {lookupError ? <Text style={styles.lookupError}>{lookupError}</Text> : null}

          {localityOptions.length > 0 ? (
            <View style={styles.optionBlock}>
              <FieldLabel>Locality / area *</FieldLabel>
              <Text style={styles.optionHint}>
                {localityOptions.length > 1
                  ? "This pin covers more than one area — pick yours:"
                  : "Suggested area for this pin:"}
              </Text>
              <View style={styles.chipRow}>
                {localityOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={locality === option}
                    onPress={() => setLocality(option)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <FieldInput
              label="Locality / area *"
              placeholder="e.g. Indiranagar, Koramangala"
              value={locality}
              onChangeText={setLocality}
            />
          )}

          {localityOptions.length > 0 ? (
            <FieldInput
              label="Or type a different area"
              placeholder="e.g. Indiranagar"
              value={
                localityOptions.includes(locality) ? "" : locality
              }
              onChangeText={setLocality}
            />
          ) : null}

          <FieldInput
            label="City"
            placeholder="e.g. Bengaluru"
            value={city}
            onChangeText={setCity}
          />
          <FieldInput
            label={countryCode === "US" ? "State" : "State / region"}
            placeholder={countryCode === "US" ? "e.g. California" : "e.g. Karnataka"}
            value={state}
            onChangeText={setState}
          />
        </View>
      ) : null}

      {alreadyComplete && showAreaFields ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="home-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Apartment / community</Text>
          </View>
          <FieldInput
            label="Community name (optional)"
            placeholder="e.g. Green Valley Apartments"
            value={communityName}
            onChangeText={setCommunityName}
            hint="Optional — connects you with parents in the same gated community"
          />
          {communitySuggestions.length > 0 ? (
            <View style={styles.optionBlock}>
              <Text style={styles.optionHint}>
                Communities other parents in this area have added:
              </Text>
              <View style={styles.chipRow}>
                {communitySuggestions.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    selected={communityName === name}
                    onPress={() => setCommunityName(name)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {canContinue ? (
        <PrimaryButton
          label={alreadyComplete ? "Save location" : "Continue"}
          onPress={onFinish}
          loading={loading}
        />
      ) : null}

      {alreadyComplete ? null : <SignOutButton />}

      <Modal
        visible={countryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCountryOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Country</Text>
            <Pressable onPress={() => setCountryOpen(false)} accessibilityRole="button">
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={sortedCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.countryRow,
                  item.code === countryCode && styles.countryRowActive,
                ]}
                onPress={() => selectCountry(item.code)}
              >
                <Text
                  style={[
                    styles.countryName,
                    item.code === countryCode && styles.countryNameActive,
                  ]}
                >
                  {countryLabel(item)}
                </Text>
                {item.code === countryCode ? (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
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
  dropdown: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dropdownText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  pinHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  section: { marginBottom: 8 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  manualHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 12,
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  lookupText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  lookupError: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 12,
  },
  optionBlock: {
    marginBottom: 14,
  },
  optionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  error: { color: colors.error, marginBottom: 8 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.textMuted, fontSize: 15 },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 16,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  countryRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countryRowActive: {
    backgroundColor: colors.primarySoft,
  },
  countryName: {
    fontSize: 16,
    color: colors.text,
  },
  countryNameActive: {
    fontWeight: "700",
    color: colors.primaryDark,
  },
});
