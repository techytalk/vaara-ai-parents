import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type PostalCountry } from "@/lib/api";
import { onboardingGeoParams, trackEvent, trackOnboardingBegin } from "@/lib/analytics";
import { invalidateFamilyMeta } from "@/lib/authenticated-state";
import {
  useAndroidImeDockOffset,
  useKeyboardHeight,
} from "@/hooks/useKeyboardHeight";
import { getToken, getStoredUser, saveSession } from "@/lib/session";
import {
  getOnboardingLocation,
  hydrateOnboardingDraft,
  setOnboardingLocation,
  setOnboardingStep,
  ensureOnboardingAttemptId,
} from "@/lib/onboarding-draft";
import { prefetchSchoolsForLocation } from "@/lib/reference-cache";
import { getPostalCountriesCached } from "@/lib/reference-cache";
import {
  Chip,
  colors,
  FieldInput,
  FieldLabel,
  OnboardingPayoff,
  PrimaryButton,
  useOnboardingContentStyle,
} from "@/components/onboarding/ui";
import { OnboardingAccountSwitch } from "@/components/SignOutButton";

const FEATURED_COUNTRY_CODES = ["IN", "US", "GB", "CA", "AU", "SG", "AE", "DE"];
const AREA_ROW_HEIGHT = 48;

/** How many area rows fit without crowding the form (short / regular / tall). */
function areaInlineBudget(usableHeight: number): number {
  if (usableHeight < 560) return 4;
  if (usableHeight > 700) return 8;
  return 6;
}

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

/** Trust-safe hooks: curiosity without claiming an active community. */
function locationHook(opts: {
  pinReady: boolean;
  lookupLoading: boolean;
  place: string;
  hasAreaChoices: boolean;
}): { title: ReactNode; body: string } {
  const { pinReady, lookupLoading, place, hasAreaChoices } = opts;

  if (!pinReady) {
    return {
      title: (
        <>
          Enter your <Text style={hookAccent}>current PIN code</Text> to find
          parents from different schools in your area.
        </>
      ),
      body: "Compare experiences, ask questions and discover what's happening nearby.",
    };
  }

  if (lookupLoading) {
    return {
      title: (
        <>
          Enter your <Text style={hookAccent}>current PIN code</Text> to find
          parents from different schools in your area.
        </>
      ),
      body: "Finding your area…",
    };
  }

  if (!place) {
    return {
      title: (
        <>
          Where do your parent{" "}
          <Text style={hookAccent}>conversations</Text> happen?
        </>
      ),
      body: hasAreaChoices
        ? "Choose your area to find parents nearby."
        : "Add your area to find parents from different schools nearby.",
    };
  }

  if (hasAreaChoices) {
    return {
      title: (
        <>
          You&apos;re joining the{" "}
          <Text style={hookAccent}>{place}</Text> parent community.
        </>
      ),
      body: "Find parents from different schools in your area to share, ask and compare.",
    };
  }

  return {
    title: (
      <>
        What are parents in <Text style={hookAccent}>{place}</Text> talking
        about?
      </>
    ),
    body: "Find parents from different schools nearby. Compare experiences, ask questions and discover what's happening in your area.",
  };
}

const hookAccent = {
  color: colors.primary,
  textDecorationLine: "underline" as const,
  textDecorationColor: colors.primaryLight,
};

export default function LocationScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const androidDockOffset = useAndroidImeDockOffset(0);
  const contentStyle = useOnboardingContentStyle();
  const footerContentStyle = useOnboardingContentStyle({
    includeVertical: false,
  });
  const inlineBudget = areaInlineBudget(windowHeight - headerHeight);
  const [countries, setCountries] = useState<PostalCountry[]>([]);
  const [countryCode, setCountryCode] = useState("IN");
  const [countryOpen, setCountryOpen] = useState(false);
  const [localityOpen, setLocalityOpen] = useState(false);
  const [areaFilter, setAreaFilter] = useState("");
  const [areaNotListed, setAreaNotListed] = useState(false);
  const [localityAutoFocus, setLocalityAutoFocus] = useState(false);
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
  const scrollRef = useRef<ScrollView>(null);
  const pinFocusedRef = useRef(false);
  const pinSectionYRef = useRef<number | null>(null);
  const areaSectionYRef = useRef<number | null>(null);
  const pendingAreaScrollRef = useRef(false);
  const localityInputRef = useRef<TextInput>(null);
  const localityRef = useRef("");

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
  const place = locality.trim();
  const hasAreaChoices = localityOptions.length > 1;
  const hook = locationHook({
    pinReady,
    lookupLoading,
    place,
    hasAreaChoices,
  });
  const placeLine =
    place && city
      ? `${place}, ${city}`
      : place
        ? place
        : city && state
          ? `${city} · ${state}`
          : "";

  useEffect(() => {
    Promise.all([
      getPostalCountriesCached().catch(() => [] as PostalCountry[]),
      getToken(),
      getStoredUser(),
      hydrateOnboardingDraft(),
    ]).then(async ([countryList, token, stored]) => {
      ensureOnboardingAttemptId();
      setOnboardingStep("location");
      trackEvent("location_screen_view");
      if (!stored?.onboardingComplete) {
        trackEvent("onboarding_location_view");
      }
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
    localityRef.current = locality;
  }, [locality]);

  useEffect(() => {
    if (keyboardHeight <= 0 || !pinFocusedRef.current) return;
    const pinY = pinSectionYRef.current;
    if (pinY == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, pinY - 12),
        animated: true,
      });
    });
  }, [keyboardHeight]);

  useEffect(() => {
    const postal = pinCode.trim();
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }

    if (!selectedCountry?.lookupSupported || !isReadyForLookup(selectedCountry, postal)) {
      setLookupLoading(false);
      setLocalityOptions([]);
      setCommunitySuggestions([]);
      setLookupError(null);
      return;
    }

    const requestId = ++lookupRequestRef.current;
    setLookupLoading(true);
    setLookupError(null);
    const timer = setTimeout(async () => {
      const started = Date.now();
      try {
        const lookup = await api.lookupPostalCode(countryCode, postal);
        if (requestId !== lookupRequestRef.current) return;

        trackEvent("pin_lookup", {
          ms: Date.now() - started,
          source: lookup.source ?? "ok",
        });
        setCity(lookup.city);
        setState(lookup.state);
        const names = lookup.localities.map((item) => item.name);
        setLocalityOptions(names);
        setCommunitySuggestions(lookup.communities ?? []);
        const currentLocality = localityRef.current.trim();
        const isSavedCustomArea =
          currentLocality.length > 0 &&
          names.length > 0 &&
          !names.includes(currentLocality);

        if (isSavedCustomArea) {
          setAreaNotListed(true);
        } else if (names.length === 1) {
          setLocality(names[0]);
          setAreaNotListed(false);
        } else {
          setAreaNotListed(false);
        }

        if (names.length >= 1) {
          setLocalityAutoFocus(false);
          Keyboard.dismiss();
          pendingAreaScrollRef.current = true;
          const areaY = areaSectionYRef.current;
          if (areaY !== null) {
            pendingAreaScrollRef.current = false;
            requestAnimationFrame(() => {
              scrollRef.current?.scrollTo({
                y: Math.max(0, areaY - 12),
                animated: true,
              });
            });
          }
        } else {
          setAreaNotListed(false);
          setLocalityAutoFocus(true);
          requestAnimationFrame(() => {
            localityInputRef.current?.focus();
          });
        }

        if (alreadyComplete) {
          const token = await getToken();
          if (token) {
            api
              .getCommunitySuggestions(token, {
                country: countryCode,
                pin: postal,
              })
              .then((res) => {
                if (requestId === lookupRequestRef.current) {
                  setCommunitySuggestions(res.communities);
                }
              })
              .catch(() => undefined);
          }
        }
      } catch (e) {
        if (requestId !== lookupRequestRef.current) return;
        trackEvent("pin_lookup", {
          ms: Date.now() - started,
          error: "1",
        });
        setLocalityOptions([]);
        setCommunitySuggestions([]);
        setAreaNotListed(false);
        setLookupError(
          e instanceof Error
            ? e.message
            : `Could not look up this ${selectedCountry?.postalLabel.toLowerCase() ?? "postal code"}`
        );
        setLocalityAutoFocus(true);
        requestAnimationFrame(() => {
          localityInputRef.current?.focus();
        });
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
    localityRef.current = "";
    setCity("");
    setState("");
    setLocalityOptions([]);
    setCommunitySuggestions([]);
    setLookupLoading(false);
    setLookupError(null);
    setLocalityOpen(false);
    setAreaFilter("");
    setAreaNotListed(false);
    setLocalityAutoFocus(false);
  }

  function selectListedArea(option: string, source: "list" | "sheet") {
    setLocality(option);
    localityRef.current = option;
    setAreaNotListed(false);
    setLocalityOpen(false);
    setAreaFilter("");
    trackEvent("area_selected", { source });
  }

  function openAreaNotListed(from: "list" | "sheet") {
    if (localityOptions.includes(locality)) {
      setLocality("");
      localityRef.current = "";
    }
    setAreaNotListed(true);
    setLocalityOpen(false);
    setAreaFilter("");
    setLocalityAutoFocus(true);
    trackEvent("area_selected", { source: "not_listed", from });
    requestAnimationFrame(() => {
      localityInputRef.current?.focus();
    });
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
        const nextUser = {
          ...storedUser,
          onboardingComplete: result.onboardingComplete ?? storedUser.onboardingComplete,
        };
        await saveSession(token, nextUser);
        if (alreadyComplete) {
          invalidateFamilyMeta({ user: nextUser, children: false });
        }
      } else if (alreadyComplete) {
        invalidateFamilyMeta({ children: false });
      }

      if (alreadyComplete) {
        trackEvent("location_updated", {
          country: countryCode,
        });
        trackEvent(
          "onboarding_geo",
          onboardingGeoParams({
            phase: "location",
            countryCode,
            enteredCity: city,
            enteredState: state,
            pinCode: postal,
          })
        );
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(app)");
        }
        return;
      }

      trackEvent("onboarding_location_complete", {
        country: countryCode,
      });
      trackEvent(
        "onboarding_geo",
        onboardingGeoParams({
          phase: "location",
          countryCode,
          enteredCity: city,
          enteredState: state,
          pinCode: postal,
        })
      );
      void prefetchSchoolsForLocation({
        country: countryCode,
        pin: postal,
        locality: locality.trim() || undefined,
      });
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

  const postalLabel =
    countryCode === "IN"
      ? "Current PIN code"
      : `Current ${selectedCountry?.postalLabel ?? "postal code"}`;
  const postalPlaceholder = selectedCountry?.placeholder ?? "Enter postal code";
  const usesNumericPostal =
    countryCode === "IN" ||
    countryCode === "US" ||
    countryCode === "AU" ||
    countryCode === "SG";

  const hasOverflow =
    localityOptions.length > 1 && localityOptions.length > inlineBudget;
  const inlineAreas = hasOverflow
    ? localityOptions.slice(0, Math.max(1, inlineBudget - 1))
    : localityOptions.length > 1
      ? localityOptions
      : [];
  const filterNorm = areaFilter.trim().toLowerCase();
  const filteredSheetAreas = filterNorm
    ? localityOptions.filter((name) => name.toLowerCase().includes(filterNorm))
    : localityOptions;
  const showFreeTextLocality =
    !lookupLoading && (localityOptions.length === 0 || areaNotListed);
  const listedSelected =
    !areaNotListed && localityOptions.includes(locality);

  function scrollPinAboveKeyboard() {
    const pinY = pinSectionYRef.current;
    if (pinY == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, pinY - 12),
        animated: true,
      });
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          contentStyle,
          { paddingBottom: 28 + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
      >
      <OnboardingPayoff
        compact
        title={hook.title}
        body={hook.body}
        illustration={require("../../assets/illustrations/onboarding-location-near-you.png")}
      />

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

      <View
        onLayout={(event) => {
          pinSectionYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <FieldInput
          label={postalLabel}
          placeholder={postalPlaceholder}
          keyboardType={usesNumericPostal ? "number-pad" : "default"}
          autoCapitalize={usesNumericPostal ? "none" : "characters"}
          value={pinCode}
          onFocus={() => {
            pinFocusedRef.current = true;
            scrollPinAboveKeyboard();
          }}
          onBlur={() => {
            pinFocusedRef.current = false;
          }}
          onChangeText={(value) => {
            const next = usesNumericPostal
              ? value.replace(/\D/g, "")
              : value.toUpperCase();
            if (next !== pinCode) {
              resetArea();
            }
            setPinCode(next);
            if (
              selectedCountry?.lookupSupported &&
              isReadyForLookup(selectedCountry, next)
            ) {
              setLookupLoading(true);
            }
          }}
          hint="We use your PIN to find nearby parents — never your street address."
        />
      </View>

      {placeLine && !lookupLoading && !lookupError ? (
        <View style={styles.placeLine}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={styles.placeLineText}>{placeLine}</Text>
        </View>
      ) : null}

      {showAreaFields ? (
        <View
          onLayout={(event) => {
            const areaY = event.nativeEvent.layout.y;
            areaSectionYRef.current = areaY;
            if (pendingAreaScrollRef.current) {
              pendingAreaScrollRef.current = false;
              requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({
                  y: Math.max(0, areaY - 12),
                  animated: true,
                });
              });
            }
          }}
        >
          {!selectedCountry?.lookupSupported ? (
            <Text style={styles.manualHint}>
              Postal lookup isn&apos;t available for this country yet. Enter your
              locality, city and state.
            </Text>
          ) : null}

          {lookupLoading ? (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.lookupText}>Finding your area…</Text>
            </View>
          ) : null}

          {lookupError ? <Text style={styles.lookupError}>{lookupError}</Text> : null}

          {localityOptions.length > 1 ? (
            <View style={styles.optionBlock}>
              <FieldLabel>Choose your area</FieldLabel>
              <Text style={styles.optionHint}>
                Choose your area to find parents nearby:
              </Text>
              <View style={styles.areaList}>
                {inlineAreas.map((option) => {
                  const selected = listedSelected && option === locality;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.areaRow, selected && styles.areaRowActive]}
                      onPress={() => selectListedArea(option, "list")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option}
                    >
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.areaRowText,
                          selected && styles.areaRowTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
                {hasOverflow ? (
                  <Pressable
                    style={styles.areaRow}
                    onPress={() => {
                      setAreaFilter("");
                      setLocalityOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Show all ${localityOptions.length} areas`}
                  >
                    <Ionicons
                      name="search-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.areaShowAllText}>
                      Show all {localityOptions.length} areas
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={styles.notListedLink}
                onPress={() => openAreaNotListed("list")}
                accessibilityRole="button"
                accessibilityLabel="My area isn't listed"
              >
                <Text
                  style={[
                    styles.notListedLinkText,
                    areaNotListed && styles.notListedLinkTextActive,
                  ]}
                >
                  My area isn&apos;t listed
                </Text>
                {areaNotListed ? (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            </View>
          ) : localityOptions.length === 1 ? (
            <View style={styles.optionBlock}>
              <Pressable
                style={styles.notListedLink}
                onPress={() => openAreaNotListed("list")}
                accessibilityRole="button"
                accessibilityLabel="My area isn't listed"
              >
                <Text
                  style={[
                    styles.notListedLinkText,
                    areaNotListed && styles.notListedLinkTextActive,
                  ]}
                >
                  My area isn&apos;t listed
                </Text>
                {areaNotListed ? (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            </View>
          ) : null}

          {showFreeTextLocality ? (
            <FieldInput
              ref={localityInputRef}
              label="Locality / area *"
              placeholder="e.g. Indiranagar, Koramangala"
              value={locality}
              autoFocus={localityAutoFocus}
              onChangeText={(v) => {
                setLocality(v);
                localityRef.current = v;
                if (v.trim()) {
                  trackEvent("area_selected", {
                    source: areaNotListed ? "not_listed" : "typed",
                  });
                }
              }}
            />
          ) : null}

          {city && state && !lookupError ? (
            place ? null : (
              <Text style={styles.resolvedLine}>
                {city} · {state}
              </Text>
            )
          ) : (
            <>
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
            </>
          )}
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
      {!canContinue ? (
        <Text style={styles.pinHint}>
          {pinReady && (areaNotListed || localityOptions.length === 0)
            ? "Type your area to continue."
            : "Enter your current PIN code and area to continue."}
        </Text>
      ) : null}
      </ScrollView>

      <View
        style={[
          styles.footerDock,
          androidDockOffset > 0
            ? { marginBottom: androidDockOffset }
            : null,
        ]}
      >
        <View style={footerContentStyle}>
          <PrimaryButton
            label={alreadyComplete ? "Save location" : "Continue"}
            onPress={onFinish}
            loading={loading}
            disabled={!canContinue}
          />

          {alreadyComplete ? null : <OnboardingAccountSwitch step="location" />}
        </View>
      </View>

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

      <Modal
        visible={localityOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setLocalityOpen(false);
          setAreaFilter("");
        }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Select your area</Text>
            <Pressable
              onPress={() => {
                setLocalityOpen(false);
                setAreaFilter("");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.areaSearch}
            placeholder="Search areas…"
            placeholderTextColor={colors.textSubtle}
            value={areaFilter}
            onChangeText={setAreaFilter}
            autoFocus={false}
            autoCorrect={false}
            clearButtonMode="while-editing"
            testID="clarity-mask"
          />
          <FlatList
            data={filteredSheetAreas}
            keyExtractor={(option) => option}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Pressable
                style={styles.sheetEmpty}
                onPress={() => openAreaNotListed("sheet")}
                accessibilityRole="button"
              >
                <Text style={styles.sheetEmptyText}>
                  No areas match — My area isn&apos;t listed
                </Text>
              </Pressable>
            }
            ListFooterComponent={
              filteredSheetAreas.length > 0 ? (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => openAreaNotListed("sheet")}
                  accessibilityRole="button"
                >
                  <Text style={styles.notListedLinkText}>
                    My area isn&apos;t listed
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = listedSelected && item === locality;
              return (
                <Pressable
                  style={[
                    styles.countryRow,
                    selected && styles.countryRowActive,
                  ]}
                  onPress={() => selectListedArea(item, "sheet")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.countryName,
                      selected && styles.countryNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {},
  footerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 6,
    paddingBottom: 6,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  resolvedLine: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 10,
    marginTop: 2,
  },
  placeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    marginTop: 2,
  },
  placeLineText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryDark,
    flexShrink: 1,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    marginTop: -6,
    marginBottom: 8,
  },
  section: { marginBottom: 8 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
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
    marginBottom: 8,
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  lookupText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  lookupError: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 8,
  },
  optionBlock: {
    marginBottom: 10,
  },
  optionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 8,
  },
  areaList: {
    gap: 8,
    marginBottom: 4,
  },
  areaRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: AREA_ROW_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  areaRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  areaRowText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  areaRowTextActive: {
    fontWeight: "700",
    color: colors.primaryDark,
  },
  areaShowAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    flex: 1,
  },
  notListedLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  notListedLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  notListedLinkTextActive: {
    color: colors.primaryDark,
  },
  areaSearch: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  sheetEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sheetEmptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
    paddingVertical: 12,
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
    flex: 1,
    marginRight: 8,
  },
  countryNameActive: {
    fontWeight: "700",
    color: colors.primaryDark,
  },
});
