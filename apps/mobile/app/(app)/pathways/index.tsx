import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { stageForStripIndex } from "@vaara/shared/pathways";
import { Chip, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  api,
  type PathwayCard,
  type PathwayHubChild,
  type PathwayHubResponse,
} from "@/lib/api";
import { getToken } from "@/lib/session";

function PathwayCardRow({
  card,
  onPress,
}: {
  card: PathwayCard;
  onPress: () => void;
}) {
  const dimmed =
    card.visibility === "dimmed" ||
    card.visibility === "contrast" ||
    card.visibility === "inactive";
  const isPrompt = card.slug.startsWith("_");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.summary}`}
      disabled={isPrompt}
      onPress={isPrompt ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        dimmed && styles.cardDimmed,
        pressed && !isPrompt && styles.cardPressed,
      ]}
    >
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, dimmed && styles.cardTitleDimmed]}>
          {card.title}
        </Text>
        <Text style={[styles.cardSummary, dimmed && styles.cardSummaryDimmed]}>
          {card.summary}
        </Text>
      </View>
      {card.whenLabel ? (
        <Text style={styles.whenLabel}>{card.whenLabel}</Text>
      ) : null}
      {!isPrompt ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={dimmed ? colors.textSubtle : colors.textMuted}
        />
      ) : null}
    </Pressable>
  );
}

export default function PathwaysHubScreen() {
  const router = useRouter();
  const [hub, setHub] = useState<PathwayHubResponse | null>(null);
  const [childId, setChildId] = useState<string | undefined>();
  const [stream, setStream] = useState("undecided");
  const [stage, setStage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.getPathwaysHub(token, {
        childId,
        stream,
        stage,
      });
      setHub(data);
      setError(null);
      if (!childId && data.context.childId) {
        setChildId(data.context.childId);
      }
    } catch (e) {
      setHub(null);
      setError(
        e instanceof Error ? e.message : "Could not load Child's Path."
      );
    }
  }, [childId, stream, stage]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function openCard(card: PathwayCard) {
    if (card.slug.startsWith("_")) return;
    router.push({
      pathname: "/(app)/pathways/[slug]",
      params: { slug: card.slug, title: card.title },
    } as never);
  }

  function onStreamPress(id: string) {
    setStream((prev) => (prev === id ? "undecided" : id));
  }

  function onStripPress(index: number) {
    const next = stageForStripIndex(index);
    if (!next) return;
    setStage(next);
    // Reset stream when leaving stages that use chips
    if (next !== "board_10" && next !== "senior" && next !== "after_10") {
      setStream("undecided");
    }
  }

  function onChildPress(child: PathwayHubChild) {
    if (child.id === childId) return;
    setChildId(child.id);
    setStream("undecided");
    setStage(undefined);
  }

  if (loading) {
    return <ScreenLoader label="Loading Child's Path" />;
  }

  if (error || !hub) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="map-outline"
          title="Child's Path unavailable"
          message={
            error ??
            "Add a school-age child with a board to see What next and Opportunities."
          }
        />
      </View>
    );
  }

  const { context, groups, children } = hub;
  const schoolChildren = children;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      {schoolChildren.length > 1 ? (
        <View style={styles.chipRow}>
          {schoolChildren.map((child) => (
            <Chip
              key={child.id}
              label={child.nickname?.trim() || "Child"}
              selected={child.id === context.childId}
              onPress={() => onChildPress(child)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.contextBlock}>
        <Text style={styles.contextLine}>
          {context.childLabel} · {context.boardLabel} · {context.gradeLabel}
        </Text>
        <Text style={styles.stateLine}>
          {context.stateLabel ?? "India (national)"}
        </Text>
      </View>

      <View style={styles.strip}>
        {context.stripLabels.map((label, index) => {
          const active = index === context.stripIndex;
          return (
            <Pressable
              key={`${label}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} stage`}
              onPress={() => onStripPress(index)}
              style={({ pressed }) => [
                styles.stripStop,
                active && styles.stripStopActive,
                pressed && styles.stripStopPressed,
              ]}
            >
              <Text
                style={[
                  styles.stripLabel,
                  active && styles.stripLabelActive,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.stripUnderline,
                  active && styles.stripUnderlineActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.stageLead}>{context.stageLead}</Text>

      {context.showStreamChips ? (
        <View style={styles.chipRow}>
          {context.streamChipLabels.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={stream === chip.id}
              onPress={() => onStreamPress(chip.id)}
            />
          ))}
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.cardList}>
            {group.cards.map((card) => (
              <PathwayCardRow
                key={card.slug}
                card={card}
                onPress={() => openCard(card)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  contextBlock: { gap: 2 },
  contextLine: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  stateLine: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 2,
  },
  stripStop: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  stripStopActive: {},
  stripStopPressed: { opacity: 0.7 },
  stripLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  stripLabelActive: {
    color: colors.primary,
  },
  stripUnderline: {
    marginTop: 6,
    height: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  stripUnderlineActive: {
    backgroundColor: colors.primary,
    height: 4,
  },
  stageLead: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  section: { gap: spacing.xs },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardList: { gap: spacing.xs },
  card: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDimmed: {
    opacity: 0.55,
    backgroundColor: colors.surfaceMuted,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  cardTitleDimmed: { color: colors.textMuted },
  cardSummary: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  cardSummaryDimmed: { color: colors.textSubtle },
  whenLabel: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.semibold,
    maxWidth: 88,
    textAlign: "right",
  },
});
