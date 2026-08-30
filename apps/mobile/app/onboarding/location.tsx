import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type PostalCountry } from "@/lib/api";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import {
  Chip,
  colors,
  FieldInput,
  InfoCard,
  OnboardingHeader,
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

export default function LocationScreen() {
  const router = useRouter();
  const [countries, setCountries] = useState<PostalCountry[]>([]);
  const [countryCode, setCountryCode] = useState("IN");
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
  const lookupRequestRef = useRef(0);
  const skipNextLookupRef = useRef(false);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === countryCode) ?? null,
    [countries, countryCode]
  );

  const featuredCountries = useMemo(() => {
    const featured = FEATURED_COUNTRY_CODES.map((code) =>
      countries.find((country) => country.code === code)
    ).filter((country): country is PostalCountry => Boolean(country));
    if (featured.length > 0) return featured;
    return countries.slice(0, 8);
  }, [countries]);

  useEffect(() => {
    Promise.all([
      api.getPostalCountries().catch(() => [] as PostalCountry[]),
      getToken(),
    ]).then(async ([countryList, token]) => {
      setCountries(countryList);
      if (!token) {
        setPrefillLoading(false);
        return;
      }
      try {
        const loc = await api.getLocation(token);
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

  async function onFinish() {
    const postal = pinCode.trim();
    if (!postal) {
      setError(`${selectedCountry?.postalLabel ?? "Postal code"} is required`);
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
        communityName: communityName.trim() || undefined,
      });

      const storedUser = await getStoredUser();
      if (storedUser) {
        await saveSession(token, {
          ...storedUser,
          onboardingComplete: result.onboardingComplete ?? true,
        });
      }

      router.replace("/(app)");
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
  const usesNumericPostal = countryCode === "IN" || countryCode === "US" || countryCode === "AU" || countryCode === "SG";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader
        step={2}
        totalSteps={2}
        title="Your location"
        subtitle="Help us connect you with parents in your neighbourhood and housing community."
      />

      <InfoCard>
        Choose your country, enter your postal code, and we&apos;ll fill in city
        and state where possible. Add your apartment or community name to join
        your housing circle too.
      </InfoCard>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="earth-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Country</Text>
        </View>
        <View style={styles.chipRow}>
          {featuredCountries.map((country) => (
            <Chip
              key={country.code}
              label={country.code === "IN" ? "India" : country.name}
              selected={countryCode === country.code}
              onPress={() => {
                if (country.code !== countryCode) {
                  setPinCode("");
                  setLocality("");
                  setCity("");
                  setState("");
                  setLocalityOptions([]);
                  setCommunitySuggestions([]);
                  setLookupError(null);
                }
                setCountryCode(country.code);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Area & postal code</Text>
        </View>

        <FieldInput
          label={postalLabel}
          placeholder={postalPlaceholder}
          keyboardType={usesNumericPostal ? "number-pad" : "default"}
          autoCapitalize={usesNumericPostal ? "none" : "characters"}
          value={pinCode}
          onChangeText={(value) =>
            setPinCode(
              usesNumericPostal ? value.replace(/\D/g, "") : value.toUpperCase()
            )
          }
          hint="Required — used to match you with nearby parents"
        />

        {!selectedCountry?.lookupSupported ? (
          <Text style={styles.manualHint}>
            Postal lookup isn&apos;t available for this country yet. Enter your
            city and state manually.
          </Text>
        ) : null}

        {lookupLoading ? (
          <View style={styles.lookupRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.lookupText}>Looking up {postalLabel.toLowerCase()}…</Text>
          </View>
        ) : null}

        {lookupError ? <Text style={styles.lookupError}>{lookupError}</Text> : null}

        <FieldInput
          label="Locality / area"
          placeholder="e.g. Indiranagar, IDA Jeedimetla"
          value={locality}
          onChangeText={setLocality}
          hint={
            localityOptions.length > 0
              ? "Type your area or tap a suggestion below"
              : undefined
          }
        />

        {localityOptions.length > 0 ? (
          <View style={styles.optionBlock}>
            <Text style={styles.optionHint}>
              {localityOptions.length > 1
                ? "This pin code covers multiple areas — pick the one closest to you:"
                : "Suggested area for this pin code:"}
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={pinCode ? "Save location" : "Finish setup"}
        onPress={onFinish}
        loading={loading}
      />

      <SignOutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
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
});
