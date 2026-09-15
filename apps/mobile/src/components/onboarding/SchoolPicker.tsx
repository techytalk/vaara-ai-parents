import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiError,
  api,
  type School,
  type SchoolListItem,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { ensureOnboardingAttemptId } from "@/lib/onboarding-draft";
import {
  ensureSchoolCatalog,
  filterLocalCatalog,
  getSchoolShortlistCached,
} from "@/lib/reference-cache";
import { colors, FieldInput, FieldLabel } from "@/components/onboarding/ui";

type Props = {
  token: string;
  selected: School | null;
  onSelect: (school: School | null) => void;
  defaultCity?: string;
  defaultPin?: string;
  defaultState?: string;
  defaultLocality?: string;
  defaultCountry?: string;
  onCreateModeChange?: (open: boolean) => void;
};

function toSchool(item: SchoolListItem): School {
  return {
    id: item.id,
    name: item.name,
    branch: item.branch,
    city: item.city,
    state: item.state,
    pinCode: item.pinCode,
    verified: item.verified,
    displayLabel: item.displayLabel,
    boardCodes: item.boardCodes,
  };
}

export function SchoolPicker({
  token,
  selected,
  onSelect,
  defaultCity = "",
  defaultPin = "",
  defaultState = "",
  defaultLocality = "",
  defaultCountry = "IN",
  onCreateModeChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [shortlist, setShortlist] = useState<SchoolListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [shortlistReady, setShortlistReady] = useState(false);
  const [searchSettled, setSearchSettled] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [candidates, setCandidates] = useState<School[]>([]);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(
    null
  );
  const [addName, setAddName] = useState("");
  const [addBranch, setAddBranch] = useState("");
  const [addCity, setAddCity] = useState(defaultCity);
  const [addState, setAddState] = useState(defaultState);
  const [addPin, setAddPin] = useState(defaultPin);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setAddCity(defaultCity);
    setAddState(defaultState);
    setAddPin(defaultPin);
  }, [defaultCity, defaultState, defaultPin]);

  useEffect(() => {
    onCreateModeChange?.(showAddNew);
  }, [showAddNew, onCreateModeChange]);

  useEffect(() => {
    if (selected) {
      setQuery(selected.displayLabel);
      setShowAddNew(false);
    }
  }, [selected?.id]);

  // Prefetch shortlist + catalogue
  useEffect(() => {
    let cancelled = false;
    setShortlistReady(false);
    Promise.all([
      getSchoolShortlistCached({
        country: defaultCountry,
        pin: defaultPin,
        locality: defaultLocality || undefined,
      }).catch(() => [] as SchoolListItem[]),
      ensureSchoolCatalog().catch(() => null),
    ]).then(([list]) => {
      if (cancelled) return;
      setShortlist(list);
      setShortlistReady(true);
      // Re-run local filter if the user already typed while catalogue loaded.
      const q = query.trim();
      if (q.length > 0 && q.length < 3) {
        setResults(filterLocalCatalog(q, 20));
        setSearchSettled(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [defaultCountry, defaultPin, defaultLocality]);

  // Typed search: local first, remote after 3 chars with abort
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const q = query.trim();
    if (selected && q === selected.displayLabel) {
      setResults([]);
      setSearchSettled(false);
      return;
    }
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      setSearchSettled(false);
      return;
    }

    setSearchSettled(false);
    const local = filterLocalCatalog(q, 20);
    setResults(local);
    trackEvent("school_query", {
      ms: 0,
      source: "local",
      results: local.length,
    });

    if (q.length < 3) {
      setSearching(false);
      setSearchSettled(true);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      setSearchSettled(false);
      setError(null);
      const started = Date.now();
      try {
        const remote = await api.searchSchoolsPublic(
          { q, limit: 20 },
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current) return;
        const byId = new Map<string, SchoolListItem>();
        for (const item of filterLocalCatalog(q, 20)) byId.set(item.id, item);
        for (const item of remote) byId.set(item.id, item);
        const merged = Array.from(byId.values());
        setResults(merged);
        trackEvent("school_query", {
          ms: Date.now() - started,
          source: "remote",
          results: merged.length,
        });
        if (merged.length === 0) {
          trackEvent("school_search_no_results");
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        // Keep local results visible on remote failure.
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (requestId === requestIdRef.current) {
          setSearching(false);
          setSearchSettled(true);
        }
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected?.id, selected?.displayLabel]);

  function openCreateForm() {
    trackEvent("school_create_opened");
    setShowAddNew(true);
    setAddName(query.trim());
    setCandidates([]);
    setConfirmationToken(null);
  }

  async function createSchool(confirmToken?: string | null) {
    const name = addName.trim();
    const city = addCity.trim() || defaultCity;
    if (!name || !city) {
      setError("School name and city are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const school = await api.createSchool(
        token,
        {
          name,
          branch: addBranch.trim() || undefined,
          city,
          state: addState.trim() || defaultState || undefined,
          pinCode: addPin.trim() || defaultPin || undefined,
          locality: defaultLocality || addBranch.trim() || undefined,
          ...(confirmToken ? { confirmCreateToken: confirmToken } : {}),
        },
        {
          // Only send idempotency on the final confirmed create path.
          idempotencyKey: confirmToken
            ? `${ensureOnboardingAttemptId()}:school:${name}:${city}`
            : undefined,
        }
      );
      trackEvent("school_created");
      trackEvent("school_selected", { source: "created" });
      onSelect(school);
      setShowAddNew(false);
      setCandidates([]);
      setConfirmationToken(null);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.data &&
        typeof e.data === "object" &&
        Array.isArray((e.data as { candidates?: unknown }).candidates)
      ) {
        const payload = e.data as {
          candidates: School[];
          confirmationToken?: string;
        };
        setCandidates(payload.candidates);
        setConfirmationToken(payload.confirmationToken ?? null);
        trackEvent("school_create_shown_candidates", {
          size: payload.candidates.length,
        });
        setError("Did you mean one of these schools?");
      } else {
        setError(e instanceof Error ? e.message : "Could not create school");
      }
    } finally {
      setCreating(false);
    }
  }

  const showShortlist =
    !selected && query.trim().length === 0 && !showAddNew;
  const showSearchResults =
    !selected && query.trim().length > 0 && !showAddNew;
  const showOther =
    showSearchResults && searchSettled && !searching;

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder="Search school name"
        placeholderTextColor={colors.textSubtle}
        value={query}
        onChangeText={(text) => {
          if (selected) onSelect(null);
          setQuery(text);
        }}
        autoCorrect={false}
        autoCapitalize="words"
      />
      <Text style={styles.hint}>
        Tap a school from the list, or type to search.
      </Text>

      {searching ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : null}

      {showShortlist ? (
        <View style={styles.dropdown}>
          {shortlistReady ? (
            <>
              <Text style={styles.suggestHeader}>Suggested schools</Text>
              {shortlist.map((school, index) => (
                <Pressable
                  key={school.id}
                  style={styles.resultRow}
                  onPress={() => {
                    trackEvent("shortlist_tapped", { rank: index + 1 });
                    trackEvent("school_selected", { source: "shortlist" });
                    onSelect(toSchool(school));
                  }}
                >
                  <Text style={styles.resultTitle}>{school.name}</Text>
                  <Text style={styles.resultMeta}>
                    {[school.branch, school.city].filter(Boolean).join(" · ")}
                    {!school.verified ? " · Pending review" : ""}
                  </Text>
                </Pressable>
              ))}
              {shortlist.length === 0 ? (
                <Text style={styles.suggestEmpty}>
                  No suggestions yet — type your school name.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.suggestEmpty}>Loading suggestions…</Text>
          )}
        </View>
      ) : null}

      {showSearchResults ? (
        <View style={styles.dropdown}>
          {results.map((school) => (
            <Pressable
              key={school.id}
              style={styles.resultRow}
              onPress={() => {
                trackEvent("school_selected", { source: "search" });
                onSelect(toSchool(school));
              }}
            >
              <Text style={styles.resultTitle}>{school.name}</Text>
              <Text style={styles.resultMeta}>
                {[school.branch, school.city].filter(Boolean).join(" · ")}
                {!school.verified ? " · Pending review" : ""}
              </Text>
            </Pressable>
          ))}
          {showOther ? (
            <Pressable style={styles.otherRow} onPress={openCreateForm}>
              <Text style={styles.otherTitle}>Not here / Other</Text>
              <Text style={styles.otherMeta}>Add your school</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showAddNew ? (
        <View style={styles.addForm}>
          <View style={styles.addFormHeader}>
            <Text style={styles.addFormTitle}>New school details</Text>
            <Pressable
              onPress={() => {
                setShowAddNew(false);
                setCandidates([]);
              }}
            >
              <Text style={styles.backToList}>Back to list</Text>
            </Pressable>
          </View>
          <Text style={styles.addFormHint}>
            We&apos;ll check for a close match before creating a new entry.
          </Text>

          {candidates.length > 0 ? (
            <View style={styles.candidateBlock}>
              <Text style={styles.suggestHeader}>Did you mean?</Text>
              {candidates.map((school) => (
                <Pressable
                  key={school.id}
                  style={styles.resultRow}
                  onPress={() => {
                    trackEvent("school_selected", { source: "candidate" });
                    onSelect(school);
                    setShowAddNew(false);
                    setCandidates([]);
                  }}
                >
                  <Text style={styles.resultTitle}>{school.name}</Text>
                  <Text style={styles.resultMeta}>
                    {school.displayLabel}
                    {!school.verified ? " · Pending review" : ""}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.createBtn}
                onPress={() => createSchool(confirmationToken)}
                disabled={creating || !confirmationToken}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>
                    None of these — create new
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <>
              <FieldInput
                label="School name *"
                value={addName}
                onChangeText={setAddName}
              />
              <FieldInput
                label="Branch / campus"
                value={addBranch}
                onChangeText={setAddBranch}
                placeholder="e.g. Kollur"
              />
              <FieldInput
                label="City *"
                value={addCity}
                onChangeText={setAddCity}
              />
              <FieldInput
                label="State"
                value={addState}
                onChangeText={setAddState}
              />
              <FieldInput
                label="PIN"
                value={addPin}
                onChangeText={setAddPin}
                keyboardType="number-pad"
              />
              <Pressable
                style={styles.createBtn}
                onPress={() => createSchool(null)}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>Save school & select</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {selected ? (
        <Text style={styles.selected}>Selected: {selected.displayLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.card,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    textTransform: "uppercase",
  },
  suggestEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  resultTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  resultMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  otherRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  otherTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  otherMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addForm: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
  },
  addFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  addFormTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  backToList: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  addFormHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  candidateBlock: { marginBottom: 8 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: colors.error, marginTop: 8 },
  selected: {
    marginTop: 8,
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: "600",
  },
});
