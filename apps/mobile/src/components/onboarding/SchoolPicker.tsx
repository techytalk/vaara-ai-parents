import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  /** Filters shortlist/search/create (e.g. child edit). Omit on onboarding. */
  list?: "preschool" | "school" | "preschool_campus";
  /**
   * When creating without a kind filter, set offers_preschool if the parent
   * chose the preschool track.
   */
  offersPreschoolOnCreate?: boolean;
  createLabel?: string;
  label?: string;
  placeholder?: string;
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
    kind: item.kind,
    offersPreschool: item.offersPreschool,
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
  list,
  offersPreschoolOnCreate = false,
  createLabel,
  label = "School",
  placeholder = "Select school",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [shortlist, setShortlist] = useState<SchoolListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [shortlistReady, setShortlistReady] = useState(false);
  const [searchSettled, setSearchSettled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      setQuery("");
      setShowAddNew(false);
      setMenuOpen(false);
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
        list,
      }).catch(() => [] as SchoolListItem[]),
      ensureSchoolCatalog().catch(() => null),
    ]).then(([listRows]) => {
      if (cancelled) return;
      setShortlist(listRows);
      setShortlistReady(true);
      const q = query.trim();
      if (q.length > 0 && q.length < 3 && !list) {
        setResults(filterLocalCatalog(q, 20));
        setSearchSettled(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [defaultCountry, defaultPin, defaultLocality, list]);

  // Typed search: local first (unless list filter), remote after 3 chars with abort
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      setSearchSettled(false);
      return;
    }

    setSearchSettled(false);
    const local = list ? [] : filterLocalCatalog(q, 20);
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
        const remote = list
          ? await api.searchSchools(
              token,
              {
                q,
                limit: 20,
                city: defaultCity || undefined,
                pin: defaultPin || undefined,
                list,
              },
              { signal: controller.signal }
            )
          : await api.searchSchoolsPublic(
              { q, limit: 20 },
              { signal: controller.signal }
            );
        if (requestId !== requestIdRef.current) return;
        const byId = new Map<string, SchoolListItem>();
        if (!list) {
          for (const item of filterLocalCatalog(q, 20)) byId.set(item.id, item);
        }
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
  }, [query, list, token, defaultCity, defaultPin]);

  function closeMenu() {
    setMenuOpen(false);
    setQuery("");
    setError(null);
  }

  function openCreateForm() {
    trackEvent("school_create_opened", {
      track:
        list === "preschool" || offersPreschoolOnCreate
          ? "preschool"
          : "school",
      school_kind: list === "preschool" ? "preschool" : "school",
    });
    setMenuOpen(false);
    setShowAddNew(true);
    setAddName(query.trim());
    setCandidates([]);
    setConfirmationToken(null);
  }

  function selectSchool(school: School, source: "shortlist" | "search") {
    trackEvent("school_selected", { source });
    onSelect(school);
    setMenuOpen(false);
    setQuery("");
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
      const kind = list === "preschool" ? "preschool" : "school";
      const offersPreschool =
        list === "preschool" ||
        list === "preschool_campus" ||
        offersPreschoolOnCreate
          ? true
          : undefined;
      const school = await api.createSchool(
        token,
        {
          name,
          branch: addBranch.trim() || undefined,
          city,
          state: addState.trim() || defaultState || undefined,
          pinCode: addPin.trim() || defaultPin || undefined,
          locality: defaultLocality || addBranch.trim() || undefined,
          kind,
          offersPreschool,
          ...(confirmToken ? { confirmCreateToken: confirmToken } : {}),
        },
        {
          idempotencyKey: confirmToken
            ? `${ensureOnboardingAttemptId()}:school:${name}:${city}`
            : undefined,
        }
      );
      trackEvent("school_created", {
        school_kind: school.kind ?? kind,
      });
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

  const listData: SchoolListItem[] =
    query.trim().length === 0 ? shortlist : results;
  const showOther =
    query.trim().length === 0
      ? shortlistReady
      : searchSettled && !searching;

  return (
    <View style={styles.wrap}>
      <FieldLabel>{label}</FieldLabel>

      {!showAddNew ? (
        <Pressable
          style={styles.dropdownTrigger}
          onPress={() => {
            setQuery("");
            setError(null);
            setMenuOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
          accessibilityState={{ expanded: menuOpen }}
        >
          <Text
            style={[
              styles.dropdownTriggerText,
              !selected && styles.dropdownTriggerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selected?.displayLabel || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <Modal
        visible={menuOpen && !showAddNew}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeMenu}
      >
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={closeMenu} accessibilityRole="button">
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Type to search"
              placeholderTextColor={colors.textSubtle}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear school search"
                onPress={() => setQuery("")}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          {searching ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : null}

          {query.trim().length === 0 && !shortlistReady ? (
            <Text style={styles.suggestEmpty}>Loading…</Text>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                query.trim().length === 0 || searchSettled ? (
                  <Text style={styles.suggestEmpty}>
                    {query.trim().length === 0
                      ? "No suggestions yet — type a name."
                      : "No matches"}
                  </Text>
                ) : null
              }
              ListFooterComponent={
                showOther ? (
                  <Pressable style={styles.otherRow} onPress={openCreateForm}>
                    <Text style={styles.otherTitle}>Not here / Other</Text>
                    <Text style={styles.otherMeta}>
                      {createLabel ?? "Add your school"}
                    </Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item, index }) => (
                <Pressable
                  style={[
                    styles.resultRow,
                    item.id === selected?.id && styles.resultRowActive,
                  ]}
                  onPress={() => {
                    if (query.trim().length === 0) {
                      trackEvent("shortlist_tapped", { rank: index + 1 });
                      selectSchool(toSchool(item), "shortlist");
                    } else {
                      selectSchool(toSchool(item), "search");
                    }
                  }}
                >
                  <View style={styles.resultCopy}>
                    <Text
                      style={[
                        styles.resultTitle,
                        item.id === selected?.id && styles.resultTitleActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {[item.branch, item.city].filter(Boolean).join(" · ")}
                      {!item.verified ? " · Pending review" : ""}
                    </Text>
                  </View>
                  {item.id === selected?.id ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              )}
            />
          )}

          {error ? <Text style={styles.modalError}>{error}</Text> : null}
        </View>
      </Modal>

      {showAddNew ? (
        <View style={styles.addForm}>
          <View style={styles.addFormHeader}>
            <Text style={styles.addFormTitle}>
              {createLabel ?? "New school details"}
            </Text>
            <Pressable
              onPress={() => {
                setShowAddNew(false);
                setCandidates([]);
                setMenuOpen(true);
              }}
            >
              <Text style={styles.backToList}>Back to list</Text>
            </Pressable>
          </View>

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

      {error && !menuOpen ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  dropdownTriggerPlaceholder: {
    fontWeight: "500",
    color: colors.textMuted,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 12,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  loader: { marginVertical: 8 },
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  resultRowActive: {
    backgroundColor: colors.primarySoft,
  },
  resultCopy: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  resultTitleActive: { color: colors.primary },
  resultMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  otherRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.primarySoft,
    marginTop: 4,
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
  modalError: {
    color: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
