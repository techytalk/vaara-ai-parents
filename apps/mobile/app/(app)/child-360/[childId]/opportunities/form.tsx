import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { PLAN_STATUS_OPTIONS } from "@/constants/child-360";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useLeaveWithoutSaving } from "@/hooks/useLeaveWithoutSaving";
import { api, type OpportunityCard } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { setChild360Undo } from "@/lib/child360Undo";
import { getToken } from "@/lib/session";

type CatalogueOption = {
  slug: string;
  title: string;
  summary: string;
  opportunityId: string;
  editionId: string;
};

async function loadPublishedExams(token: string, childId: string) {
  const items: OpportunityCard[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 8; page += 1) {
    const result = await api.listOpportunities(token, {
      childId,
      segment: "all",
      limit: 50,
      cursor,
    });
    if (!result.enabled) return [];
    items.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return items;
}

export default function OpportunityFormScreen() {
  const { childId, planId } = useLocalSearchParams<{
    childId: string;
    planId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const editing = Boolean(planId);

  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("exploring");
  const [targetYear, setTargetYear] = useState("");
  const [options, setOptions] = useState<CatalogueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [initialStatus, setInitialStatus] = useState("exploring");
  const [retiredPlan, setRetiredPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLeaveWithoutSaving(dirty, saving);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editing ? "Edit exam plan" : "Add an exam",
    });
  }, [navigation, editing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/(auth)/login");
          return;
        }
        const [hub, exams] = await Promise.all([
          api.getChild360(token, childId),
          loadPublishedExams(token, childId),
        ]);
        if (cancelled) return;

        const others = hub.opportunityPlans.filter((plan) => plan.id !== planId);
        const plannedEditions = new Set(
          others.map((plan) => plan.editionId).filter((id): id is string => Boolean(id))
        );
        const plannedSlugs = new Set(
          others.filter((plan) => !plan.editionId).map((plan) => plan.opportunitySlug)
        );
        const catalogue = exams
          .filter((item) => {
            if (!item.edition) return false;
            if (plannedEditions.has(item.edition.id)) return false;
            if (plannedSlugs.has(item.slug)) return false;
            return true;
          })
          .map((item) => ({
            slug: item.slug,
            title: item.edition?.editionLabel
              ? `${item.title} · ${item.edition.editionLabel}`
              : item.title,
            summary: item.checks?.copy || item.edition?.eligibilitySummary || item.kind,
            opportunityId: item.opportunityId ?? "",
            editionId: item.edition?.id ?? "",
          }))
          .filter((item) => item.editionId && item.opportunityId);
        setOptions(catalogue);

        if (planId) {
          const row = hub.opportunityPlans.find((p) => p.id === planId);
          if (!row) {
            setError("Plan not found");
            return;
          }
          setSlug(row.editionId ?? row.opportunitySlug);
          setStatus(row.status);
          setInitialStatus(row.status);
          setTargetYear(
            row.targetYear != null ? String(row.targetYear) : ""
          );
          setTitle(row.title ?? row.opportunitySlug.toUpperCase());
          setRetiredPlan(row.publicationStatus === "retired");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, planId, router]);

  const selected = useMemo(
    () => options.find((option) => option.editionId === slug) ?? null,
    [options, slug]
  );

  const canSave = (editing || Boolean(selected)) && !saving;

  async function onSave() {
    if (!canSave || !slug) return;
    setSaving(true);
    setDirty(false);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const yearRaw = targetYear.trim();
      const year =
        yearRaw === "" ? null : Number.parseInt(yearRaw, 10);
      if (
        yearRaw !== "" &&
        (!Number.isInteger(year) || year! < 2000 || year! > 2100)
      ) {
        setDirty(true);
        setError("Year must be between 2000 and 2100");
        setSaving(false);
        return;
      }
      if (editing && planId) {
        await api.updateChildOpportunityPlan(token, childId, planId, {
          status,
          targetYear: year,
        });
        if (status !== initialStatus) {
          trackEvent("opportunity_plan_status_changed", {
            from: initialStatus,
            to: status,
          });
        }
      } else if (selected) {
        await api.createChildOpportunityPlan(token, childId, {
          opportunityId: selected.opportunityId,
          editionId: selected.editionId,
          opportunitySlug: selected.slug,
          status,
          targetYear: year,
        });
        trackEvent("opportunity_saved", { status });
        if (status !== "exploring") {
          trackEvent("opportunity_plan_status_changed", {
            from: "exploring",
            to: status,
          });
        }
      }
      router.back();
    } catch (e) {
      setDirty(true);
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onRemove() {
    if (!planId || !slug) return;
    const label = title || slug;
    Alert.alert(`Remove ${label}?`, "You can undo for a moment after.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const token = await getToken();
              if (!token) return;
              const result = await api.deleteChildOpportunityPlan(
                token,
                childId,
                planId
              );
              setChild360Undo({
                kind: "opportunity",
                childId,
                opportunitySlug: result.deleted.opportunitySlug,
                status: result.deleted.status,
                targetYear: result.deleted.targetYear,
              });
              setDirty(false);
              router.back();
            } catch (e) {
              Alert.alert(
                "Could not remove",
                e instanceof Error ? e.message : "Try again"
              );
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Exam or opportunity</Text>
      {editing ? (
        <View style={styles.locked}>
          <Text style={styles.lockedTitle}>{title}</Text>
          {retiredPlan ? (
            <Text style={styles.lockedSummary}>This exam is no longer listed.</Text>
          ) : null}
        </View>
      ) : options.length === 0 ? (
        <Text style={styles.emptyCatalogue}>
          No published exams to add yet.
        </Text>
      ) : (
        <View style={styles.options}>
          {options.map((opt) => {
            const on = slug === opt.editionId;
            return (
              <Pressable
                key={opt.editionId}
                onPress={() => {
                  setSlug(opt.editionId);
                  setTitle(opt.title);
                  setDirty(true);
                }}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={[styles.optionTitle, on && styles.optionTitleOn]}>
                  {opt.title}
                </Text>
                <Text style={styles.optionSummary} numberOfLines={2}>
                  {opt.summary}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Status</Text>
      <View style={styles.chips}>
        {PLAN_STATUS_OPTIONS.map((opt) => {
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setStatus(opt.value);
                setDirty(true);
              }}
              style={[
                styles.chip,
                status === opt.value && styles.chipOn,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  status === opt.value && styles.chipTextOn,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Target year (optional)</Text>
      <TextInput
        value={targetYear}
        onChangeText={(t) => {
          setTargetYear(t);
          setDirty(true);
        }}
        placeholder="2027"
        placeholderTextColor={colors.textSubtle}
        keyboardType="number-pad"
        maxLength={4}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void onSave()}
        disabled={!canSave}
        style={[styles.save, !canSave && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>

      {editing ? (
        <Pressable onPress={onRemove} style={styles.remove}>
          <Text style={styles.removeText}>Remove this plan</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  label: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  options: { gap: spacing.sm },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTitle: {
    fontFamily: typography.semibold,
    fontSize: 15,
    color: colors.text,
  },
  optionTitleOn: { color: colors.primaryDark },
  optionSummary: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  locked: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  lockedTitle: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
  },
  lockedSummary: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyCatalogue: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  chipTextOn: {
    fontFamily: typography.semibold,
    color: colors.primaryDark,
  },
  hint: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.text,
  },
  save: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.45 },
  saveText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
  remove: { marginTop: spacing.lg, alignItems: "center", padding: spacing.md },
  removeText: {
    fontFamily: typography.semibold,
    color: colors.error,
    fontSize: 15,
  },
  error: {
    color: colors.error,
    marginTop: spacing.md,
    fontFamily: typography.regular,
  },
});
