import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useOriginBackHeader } from "@/hooks/useOriginBack";
import { ApiError, api, type Child, type OpportunityDetail } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";

function openOfficial(url: string) {
  Alert.alert(
    "Leaving Vaara",
    "Vaara does not register your child or collect exam fees. You are opening the organizer’s site.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        onPress: () => {
          trackEvent("opportunity_official_link_opened", { surface: "detail" });
          void Linking.openURL(url);
        },
      },
    ]
  );
}

export default function OpportunityDetailScreen() {
  useOriginBackHeader();
  const { slug, childId: childIdParam } = useLocalSearchParams<{
    slug: string;
    childId?: string;
  }>();
  const [item, setItem] = useState<OpportunityDetail | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string | null>(childIdParam ?? null);
  const [planStatus, setPlanStatus] = useState("exploring");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    const token = await getToken();
    if (!token) return;
    try {
      const result = await api.getOpportunity(token, slug);
      setItem(result.opportunity);
      setError(result.enabled ? null : "Not available yet");
      if (result.opportunity) {
        trackEvent("opportunity_detail_viewed", { slug: result.opportunity.slug });
      }
      const kids = await api.getChildren(token).catch(() => [] as Child[]);
      setChildren(kids);
      setChildId((current) => current || childIdParam || kids[0]?.id || null);
    } catch (e) {
      const offline =
        !(e instanceof ApiError) &&
        /network|offline|failed to fetch/i.test(
          e instanceof Error ? e.message : ""
        );
      setError(
        offline
          ? "No network. Connect to the internet and try again."
          : e instanceof Error
            ? e.message
            : "Could not load this exam"
      );
    }
  }, [childIdParam, slug]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading) return <ScreenLoader />;
  if (error || !item) {
    return <EmptyState title="Exam unavailable" message={error ?? "Not found"} />;
  }

  const edition = item.editions[0];

  async function savePlan() {
    if (!childId || !edition) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    setSaved(null);
    try {
      await api.createChildOpportunityPlan(token, childId, {
        opportunityId: item.id,
        editionId: edition.id,
        opportunitySlug: item.slug,
        status: planStatus,
      });
      trackEvent("opportunity_saved", { status: planStatus });
      setSaved("Saved for this child.");
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.title}</Text>
      {item.organizerName ? (
        <Text style={styles.meta}>{item.organizerName}</Text>
      ) : null}
      {edition ? (
        <Text style={styles.meta}>
          {[
            edition.editionLabel,
            edition.scopeLevel,
            edition.registrationState?.replace(/_/g, " "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : (
        <Text style={styles.meta}>Current edition details not available</Text>
      )}
      {edition?.eligibilitySummary ? (
        <Text style={styles.body}>{edition.eligibilitySummary}</Text>
      ) : null}
      {edition?.fees?.length ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Fee</Text>
          {edition.fees.map((fee, index) => (
            <Text key={`${fee.label}-${index}`} style={styles.body}>
              {fee.label}:{" "}
              {fee.amount == null
                ? "Not stated"
                : `${fee.currency} ${fee.amount}`}
              {fee.applicability ? ` (${fee.applicability})` : ""}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.body}>Fee: not stated</Text>
      )}
      {edition?.schedules?.length ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Dates</Text>
          {edition.schedules.map((row, index) => (
            <Text key={`${row.type}-${index}`} style={styles.body}>
              {row.label || row.type}:{" "}
              {row.periodText ||
                [row.startsOn, row.endsOn].filter(Boolean).join(" – ") ||
                "Not announced"}
              {row.notes ? ` — ${row.notes}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
      {children.length > 0 && edition ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Save to a child</Text>
          <View style={styles.segments}>
            {children.map((child) => (
              <Pressable
                key={child.id}
                onPress={() => setChildId(child.id)}
                style={[styles.segment, childId === child.id && styles.segmentOn]}
              >
                <Text style={styles.body}>
                  {child.nickname || child.grade?.label || "Child"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.segments}>
            {["exploring", "planning", "this_season"].map((status) => (
              <Pressable
                key={status}
                onPress={() => setPlanStatus(status)}
                style={[styles.segment, planStatus === status && styles.segmentOn]}
              >
                <Text style={styles.body}>{status.replace(/_/g, " ")}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.button} disabled={saving} onPress={() => void savePlan()}>
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
          {saved ? <Text style={styles.body}>{saved}</Text> : null}
        </View>
      ) : null}
      {edition?.registrationUrl || item.officialUrl ? (
        <Pressable
          style={styles.button}
          onPress={() =>
            openOfficial(edition?.registrationUrl || item.officialUrl || "")
          }
        >
          <Text style={styles.buttonText}>
            {edition?.registrationMethod === "through_school"
              ? "How to apply through school"
              : "Official information"}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: { fontFamily: typography.bold, fontSize: 22, color: colors.text },
  meta: { fontFamily: typography.regular, color: colors.textMuted },
  heading: { fontFamily: typography.bold, color: colors.text, marginTop: spacing.md },
  body: { fontFamily: typography.regular, color: colors.text, lineHeight: 20 },
  block: { gap: 4 },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonText: { color: colors.card, fontFamily: typography.bold },
  segments: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  segmentOn: { backgroundColor: colors.primaryLight },
});
