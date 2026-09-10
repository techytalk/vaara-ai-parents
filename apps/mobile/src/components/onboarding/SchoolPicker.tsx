import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type School, type SchoolListItem } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { colors, FieldInput, FieldLabel } from "@/components/onboarding/ui";

type Props = {
  token: string;
  selected: School | null;
  onSelect: (school: School | null) => void;
  defaultCity?: string;
  defaultPin?: string;
  defaultState?: string;
};

export function SchoolPicker({
  token,
  selected,
  onSelect,
  defaultCity = "",
  defaultPin = "",
  defaultState = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<School[]>([]);
  const [suggestions, setSuggestions] = useState<SchoolListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBranch, setAddBranch] = useState("");
  const [addCity, setAddCity] = useState(defaultCity);
  const [addState, setAddState] = useState(defaultState);
  const [addPin, setAddPin] = useState(defaultPin);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAddCity(defaultCity);
    setAddState(defaultState);
    setAddPin(defaultPin);
  }, [defaultCity, defaultState, defaultPin]);

  useEffect(() => {
    if (selected) {
      setQuery(selected.displayLabel);
      setShowAddNew(false);
    }
  }, [selected?.id]);

  // Nearby suggestions when the field is empty (browse, not search).
  useEffect(() => {
    if (selected) {
      setSuggestions([]);
      return;
    }
    const q = query.trim();
    if (q.length > 0) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoadingNearby(true);
    api
      .getNearbySchools(token, {
        city: defaultCity || undefined,
        pin: defaultPin || undefined,
        limit: 5,
      })
      .then((list) => {
        if (!cancelled) setSuggestions(list);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingNearby(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, query, token, defaultCity, defaultPin]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (selected && q === selected.displayLabel) {
      return;
    }
    if (q.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const list = await api.searchSchools(token, {
          q,
          city: defaultCity || undefined,
          pin: defaultPin || undefined,
        });
        setResults(list);
        if (q.length >= 3 && list.length === 0) {
          trackEvent("school_search_no_results", { query_length: q.length });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, defaultCity, defaultPin, selected]);

  function onChangeQuery(text: string) {
    setQuery(text);
    if (selected && text !== selected.displayLabel) {
      onSelect(null);
    }
    setShowAddNew(false);
  }

  function selectSchool(school: School, fromSuggestion: boolean) {
    if (fromSuggestion) {
      trackEvent("school_suggestion_tapped");
    }
    onSelect(school);
    setQuery(school.displayLabel);
    setResults([]);
    setSuggestions([]);
  }

  function openCreateForm() {
    trackEvent("school_create_opened");
    setShowAddNew(true);
    setAddName(query.trim());
    setAddCity(defaultCity);
    setAddState(defaultState);
    setAddPin(defaultPin);
  }

  async function onCreateSchool() {
    const name = addName.trim() || query.trim();
    const city = addCity.trim();
    if (!name || !city) {
      setError("School name and city are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const school = await api.createSchool(token, {
        name,
        branch: addBranch.trim() || undefined,
        city,
        state: addState.trim() || undefined,
        pinCode: addPin.trim() || undefined,
      });
      trackEvent("school_created");
      onSelect(school);
      setQuery(school.displayLabel);
      setShowAddNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add school");
    } finally {
      setCreating(false);
    }
  }

  const canShowResults = query.trim().length >= 2 && !selected;
  const canOfferCreate = canShowResults && !searching;
  const showNearbyPanel =
    !selected && query.trim().length === 0 && !loadingNearby;
  const showSuggestions = showNearbyPanel && suggestions.length > 0;

  return (
    <View style={styles.wrap}>
      <FieldLabel>School *</FieldLabel>
      <TextInput
        style={styles.input}
        placeholder="Search by school name…"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={onChangeQuery}
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Search by name anywhere, or pick a school near you below.
      </Text>

      {searching || loadingNearby ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : null}

      {showNearbyPanel && !showAddNew ? (
        <View style={styles.dropdown}>
          {showSuggestions ? (
            <>
              <Text style={styles.suggestHeader}>Schools near you</Text>
              {suggestions.map((school) => (
                <Pressable
                  key={school.id}
                  style={styles.resultRow}
                  onPress={() => selectSchool(school, true)}
                >
                  <Text style={styles.resultTitle}>{school.name}</Text>
                  <Text style={styles.resultMeta}>
                    {[school.branch, school.city].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <Text style={styles.suggestEmpty}>
              No schools listed near you yet — add yours below.
            </Text>
          )}
          <Pressable
            style={styles.otherRow}
            onPress={openCreateForm}
            accessibilityRole="button"
            accessibilityLabel="School not listed — enter details"
          >
            <Text style={styles.otherTitle}>Not here / Other</Text>
            <Text style={styles.otherMeta}>
              Enter your school name and details
            </Text>
          </Pressable>
        </View>
      ) : null}

      {canShowResults && results.length > 0 ? (
        <View style={styles.dropdown}>
          {results.map((school) => (
            <Pressable
              key={school.id}
              style={styles.resultRow}
              onPress={() => selectSchool(school, false)}
            >
              <Text style={styles.resultTitle}>{school.name}</Text>
              <Text style={styles.resultMeta}>
                {[school.branch, school.city].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {canOfferCreate ? (
        <Pressable style={styles.addNewRow} onPress={openCreateForm}>
          <Text style={styles.addNewText}>Can&apos;t find your school?</Text>
        </Pressable>
      ) : null}

      {showAddNew ? (
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>New school details</Text>
          <FieldInput
            label="School name *"
            value={addName}
            onChangeText={setAddName}
          />
          <FieldInput
            label="Branch / area (optional)"
            placeholder="e.g. Koramangala, Whitefield"
            value={addBranch}
            onChangeText={setAddBranch}
          />
          <FieldInput
            label="City *"
            value={addCity}
            onChangeText={setAddCity}
          />
          <FieldInput
            label="State (optional)"
            value={addState}
            onChangeText={setAddState}
          />
          <FieldInput
            label="Pin code (optional)"
            keyboardType="number-pad"
            value={addPin}
            onChangeText={setAddPin}
          />
          <Pressable
            style={styles.createBtn}
            onPress={onCreateSchool}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Save school & select</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 8,
  },
  loader: { marginVertical: 8 },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  suggestEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    lineHeight: 18,
  },
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  otherRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primarySoft,
  },
  otherTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  otherMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  resultMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  addNewRow: {
    padding: 14,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 8,
  },
  addNewText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  addForm: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  addFormTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: colors.error, fontSize: 13, marginTop: 4 },
});
