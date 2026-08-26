import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type School } from "@/lib/api";
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
  const [searching, setSearching] = useState(false);
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

  async function onCreateSchool() {
    const name = addName.trim() || query.trim();
    const branch = addBranch.trim();
    const city = addCity.trim();
    if (!name || !branch || !city) {
      setError("School name, branch, and city are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const school = await api.createSchool(token, {
        name,
        branch,
        city,
        state: addState.trim() || undefined,
        pinCode: addPin.trim() || undefined,
      });
      onSelect(school);
      setQuery(school.displayLabel);
      setShowAddNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add school");
    } finally {
      setCreating(false);
    }
  }

  const canShowResults =
    query.trim().length >= 2 &&
    !selected &&
    query.trim() !== selected?.displayLabel;

  return (
    <View style={styles.wrap}>
      <FieldLabel>School *</FieldLabel>
      <TextInput
        style={styles.input}
        placeholder="Type school name…"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={onChangeQuery}
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Start typing — pick from the list or add a new school with branch and
        city.
      </Text>

      {searching ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : null}

      {canShowResults && results.length > 0 ? (
        <View style={styles.dropdown}>
          {results.map((school) => (
            <Pressable
              key={school.id}
              style={styles.resultRow}
              onPress={() => {
                onSelect(school);
                setQuery(school.displayLabel);
                setResults([]);
              }}
            >
              <Text style={styles.resultTitle}>{school.name}</Text>
              <Text style={styles.resultMeta}>
                {[school.branch, school.city].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {canShowResults && !searching && results.length === 0 ? (
        <Pressable
          style={styles.addNewRow}
          onPress={() => {
            setShowAddNew(true);
            setAddName(query.trim());
          }}
        >
          <Text style={styles.addNewText}>
            + Add &quot;{query.trim()}&quot; as new school
          </Text>
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
            label="Branch / area *"
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
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
