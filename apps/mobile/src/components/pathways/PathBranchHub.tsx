import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pathTheme as t } from "@/constants/path-theme";
import { radii, spacing, typography } from "@/constants/theme";
import type { PathBranch, PathBranchMap, PathTopicId, PathwayCard } from "@/lib/api";
import {
  childSwitcherTabLabel,
  type ChildSwitcherFields,
} from "@/lib/child-switcher-label";

type ChildChip = ChildSwitcherFields & { id: string };

type Props = {
  childLabel: string;
  stateLabel: string;
  stageLead: string;
  branchMap: PathBranchMap;
  selectedBranch: PathBranch;
  topicId: PathTopicId;
  streamId: string;
  streamChips: Array<{ id: string; label: string }>;
  showStreamChips: boolean;
  children: ChildChip[];
  selectedChildId: string | null;
  itemLead: string | null;
  collegeCards: PathwayCard[];
  postingCircleName: string | null;
  postingHint: string | null;
  otherOpen: boolean;
  onToggleOther: () => void;
  onSelectChild: (id: string) => void;
  onSelectBranch: (id: string) => void;
  onSelectTopic: (id: PathTopicId) => void;
  onSelectStream: (id: string) => void;
  onAsk: () => void;
  onRead: () => void;
  onLearnMore: () => void;
  onOpenCard: (slug: string, title: string) => void;
  onMore: () => void;
};

export function PathBranchHub({
  childLabel,
  stateLabel,
  stageLead,
  branchMap,
  selectedBranch,
  topicId,
  streamId,
  streamChips,
  showStreamChips,
  children,
  selectedChildId,
  itemLead,
  collegeCards,
  postingCircleName,
  postingHint,
  otherOpen,
  onToggleOther,
  onSelectChild,
  onSelectBranch,
  onSelectTopic,
  onSelectStream,
  onAsk,
  onRead,
  onLearnMore,
  onOpenCard,
  onMore,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.2;
  const prompt =
    selectedBranch.prompts[topicId] ??
    selectedBranch.prompts.subjects ??
    selectedBranch.prompts.learning ??
    stageLead;
  const topicLabel =
    branchMap.topics.find((topic) => topic.id === topicId)?.label ?? "this";

  return (
    <View style={styles.page}>
      <View style={styles.nav}>
        <Text style={styles.wordmark}>vaara</Text>
        <Text style={styles.navTitle}>Child's Path</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to More"
          onPress={onMore}
          hitSlop={8}
        >
          <Text style={styles.navAction}>More</Text>
        </Pressable>
      </View>

      {children.length > 1 ? (
        <View style={styles.chipRow}>
          {children.map((child, index) => {
            const selected = child.id === selectedChildId;
            return (
              <Pressable
                key={child.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectChild(child.id)}
                style={[styles.childChip, selected && styles.miniChipOn]}
              >
                <Text
                  style={[styles.miniChipText, selected && styles.miniChipTextOn]}
                  numberOfLines={2}
                >
                  {childSwitcherTabLabel(child, index)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.eyebrow}>
        {childLabel} · {stateLabel}
      </Text>
      <Text style={styles.headline}>{branchMap.headline}</Text>
      <Text style={styles.deck}>{branchMap.deck}</Text>

      <View style={styles.node}>
        <Text style={styles.nodeKicker}>{branchMap.locationKicker}</Text>
        <Text style={styles.nodeTitle}>{branchMap.locationTitle}</Text>
        <Text style={styles.nodeMeta}>{branchMap.locationMeta}</Text>
      </View>

      <View style={styles.stem} />
      <Text style={styles.caption}>{branchMap.forkCaption}</Text>

      <View style={[styles.branchRow, stacked && styles.branchCol]}>
        {branchMap.primary.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            selected={branch.id === selectedBranch.id}
            stacked={stacked}
            onPress={() => onSelectBranch(branch.id)}
          />
        ))}
      </View>

      <View style={styles.stem} />

      <View style={styles.panel}>
        <Text style={styles.breadcrumb}>{selectedBranch.breadcrumb}</Text>
        <Text style={styles.exploreTitle}>{selectedBranch.exploreTitle}</Text>
        <Text style={styles.promptAsk}>What would you like to understand?</Text>
        {itemLead ? <Text style={styles.itemLead}>{itemLead}</Text> : null}

        <View style={styles.chipRow}>
          {branchMap.topics.map((topic) => {
            const on = topic.id === topicId;
            return (
              <Pressable
                key={topic.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onSelectTopic(topic.id)}
                style={[styles.topicChip, on && styles.topicChipOn]}
              >
                <Text style={[styles.topicText, on && styles.topicTextOn]}>
                  {topic.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {showStreamChips && selectedBranch.showStreamIntents ? (
          <View style={styles.chipRow}>
            {streamChips.map((chip) => {
              const on = streamId === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => onSelectStream(chip.id)}
                  style={[styles.miniChip, on && styles.miniChipOn]}
                >
                  <Text style={[styles.miniChipText, on && styles.miniChipTextOn]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.promptCard}>
          <Text style={styles.askKicker}>
            ASK ABOUT {topicLabel.toUpperCase()}
          </Text>
          <Text style={styles.quote}>“{prompt}”</Text>
          {postingCircleName ? (
            <Text style={styles.posting}>
              Where will this be posted? {postingCircleName}
            </Text>
          ) : (
            <Text style={styles.posting}>
              {postingHint ?? "No circle is available to post in yet."}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask parents anonymously"
            disabled={!postingCircleName}
            onPress={onAsk}
            style={[styles.cta, !postingCircleName && styles.ctaDisabled]}
          >
            <Text style={styles.ctaLabel}>Ask parents anonymously</Text>
          </Pressable>
          <Pressable onPress={onRead} accessibilityRole="link">
            <Text style={styles.link}>Read discussions on this branch →</Text>
          </Pressable>
        </View>

        {topicId === "college_plans" && collegeCards.length > 0 ? (
          <View style={styles.collegeList}>
            {collegeCards.slice(0, 5).map((card) => (
              <Pressable
                key={card.slug}
                onPress={() => onOpenCard(card.slug, card.title)}
                style={styles.collegeRow}
              >
                <View style={styles.collegeBody}>
                  <Text style={styles.collegeTitle}>{card.title}</Text>
                  <Text style={styles.collegeSummary}>{card.summary}</Text>
                </View>
                {card.whenLabel ? (
                  <Text style={styles.when}>{card.whenLabel}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {selectedBranch.itemSlug ? (
          <Pressable onPress={onLearnMore} style={styles.learnMore}>
            <Text style={styles.link}>Official details for this route →</Text>
          </Pressable>
        ) : null}
      </View>

      {branchMap.overflow.length > 0 ? (
        <View>
          <Pressable
            onPress={onToggleOther}
            accessibilityRole="button"
            style={styles.otherToggle}
          >
            <Ionicons
              name={otherOpen ? "chevron-down" : "chevron-forward"}
              size={16}
              color={t.lock}
            />
            <Text style={styles.otherLabel}>Other routes / not sure yet?</Text>
          </Pressable>
          {otherOpen
            ? branchMap.overflow.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  selected={branch.id === selectedBranch.id}
                  stacked
                  onPress={() => onSelectBranch(branch.id)}
                />
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.lockRow}>
        <Ionicons name="lock-closed-outline" size={14} color={t.lock} />
        <Text style={styles.lock}>{branchMap.lockLine}</Text>
      </View>
    </View>
  );
}

function BranchCard({
  branch,
  selected,
  stacked,
  onPress,
}: {
  branch: PathBranch;
  selected: boolean;
  stacked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${branch.kicker} ${branch.title}. ${selected ? "Exploring" : "Explore"}`}
      onPress={onPress}
      style={[
        styles.branch,
        stacked && styles.branchStacked,
        selected ? styles.branchOn : styles.branchOff,
      ]}
    >
      <Text style={[styles.branchKicker, selected && styles.branchKickerOn]}>
        {branch.kicker}
      </Text>
      <Text style={[styles.branchTitle, selected && styles.branchTitleOn]}>
        {branch.title}
      </Text>
      <Text style={[styles.branchStatus, selected && styles.branchStatusOn]}>
        {selected ? "Exploring" : "Explore"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md, paddingBottom: spacing.xxl },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  wordmark: {
    ...typography.supporting,
    color: t.navWordmark,
    fontFamily: typography.semibold,
    width: 64,
  },
  navTitle: {
    ...typography.body,
    color: t.navTitle,
    fontFamily: typography.semibold,
  },
  navAction: {
    ...typography.supporting,
    color: t.navAction,
    fontFamily: typography.semibold,
    width: 64,
    textAlign: "right",
  },
  eyebrow: {
    ...typography.caption,
    color: t.eyebrow,
    fontFamily: typography.medium,
  },
  headline: {
    ...typography.screenTitle,
    color: t.title,
    fontFamily: typography.bold,
  },
  deck: {
    ...typography.supporting,
    color: t.deck,
    fontFamily: typography.medium,
  },
  node: {
    alignItems: "center",
    backgroundColor: t.nodeFill,
    borderColor: t.nodeBorder,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  nodeKicker: {
    ...typography.caption,
    color: t.kicker,
    fontFamily: typography.semibold,
    letterSpacing: 0.8,
  },
  nodeTitle: {
    ...typography.sectionTitle,
    color: t.nodeTitle,
    fontFamily: typography.bold,
    textAlign: "center",
    marginTop: 4,
  },
  nodeMeta: {
    ...typography.supporting,
    color: t.nodeMeta,
    marginTop: 2,
  },
  stem: {
    alignSelf: "center",
    width: 2,
    height: 16,
    backgroundColor: t.treeLine,
  },
  caption: {
    ...typography.caption,
    color: t.forkCaption,
    textAlign: "center",
    fontFamily: typography.medium,
  },
  branchRow: { flexDirection: "row", gap: spacing.xs },
  branchCol: { flexDirection: "column" },
  branch: {
    flex: 1,
    minHeight: 88,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    justifyContent: "center",
    gap: 2,
  },
  branchStacked: { flex: undefined, width: "100%" },
  branchOn: {
    backgroundColor: t.branchActiveFill,
    borderColor: t.branchActiveFill,
  },
  branchOff: {
    backgroundColor: t.branchIdleFill,
    borderColor: t.branchIdleBorder,
  },
  branchKicker: {
    ...typography.caption,
    color: t.branchIdleStatus,
    fontFamily: typography.medium,
  },
  branchKickerOn: { color: t.branchActiveStatus },
  branchTitle: {
    ...typography.body,
    color: t.branchIdleText,
    fontFamily: typography.semibold,
  },
  branchTitleOn: { color: t.branchActiveText },
  branchStatus: {
    ...typography.caption,
    color: t.branchIdleStatus,
    fontFamily: typography.medium,
  },
  branchStatusOn: { color: t.branchActiveStatus },
  panel: {
    backgroundColor: t.panelFill,
    borderColor: t.panelBorder,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breadcrumb: {
    ...typography.caption,
    color: t.kicker,
    fontFamily: typography.medium,
  },
  exploreTitle: {
    ...typography.sectionTitle,
    color: t.title,
    fontFamily: typography.bold,
  },
  promptAsk: {
    ...typography.supporting,
    color: t.deck,
  },
  itemLead: {
    ...typography.supporting,
    color: t.quote,
    fontFamily: typography.medium,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  topicChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.chipIdleBorder,
    backgroundColor: t.chipIdleFill,
    justifyContent: "center",
  },
  topicChipOn: {
    backgroundColor: t.chipActiveFill,
    borderColor: t.chipActiveFill,
  },
  topicText: {
    ...typography.supporting,
    color: t.chipIdleText,
    fontFamily: typography.semibold,
  },
  topicTextOn: { color: t.chipActiveText },
  miniChip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.chipIdleBorder,
    justifyContent: "center",
  },
  miniChipOn: {
    backgroundColor: t.chipActiveFill,
    borderColor: t.chipActiveFill,
  },
  childChip: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.chipIdleBorder,
    justifyContent: "center",
  },
  miniChipText: {
    ...typography.caption,
    color: t.chipIdleText,
    fontFamily: typography.semibold,
  },
  miniChipTextOn: { color: t.chipActiveText },
  promptCard: {
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  askKicker: {
    ...typography.caption,
    color: t.promptKicker,
    fontFamily: typography.bold,
    letterSpacing: 0.6,
  },
  quote: {
    ...typography.body,
    color: t.quote,
    fontFamily: typography.medium,
  },
  posting: {
    ...typography.caption,
    color: t.kicker,
    fontFamily: typography.medium,
  },
  cta: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: t.ctaFill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: {
    ...typography.body,
    color: t.ctaText,
    fontFamily: typography.semibold,
  },
  link: {
    ...typography.supporting,
    color: t.textLink,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  collegeList: { gap: spacing.xs },
  collegeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.panelBorder,
  },
  collegeBody: { flex: 1, gap: 2 },
  collegeTitle: {
    ...typography.supporting,
    color: t.title,
    fontFamily: typography.semibold,
  },
  collegeSummary: {
    ...typography.caption,
    color: t.deck,
  },
  when: {
    ...typography.caption,
    color: t.dimmed,
    maxWidth: 80,
    textAlign: "right",
  },
  learnMore: { paddingVertical: spacing.xs },
  otherToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 44,
  },
  otherLabel: {
    ...typography.supporting,
    color: t.lock,
    fontFamily: typography.semibold,
  },
  lockRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  lock: {
    flex: 1,
    ...typography.caption,
    color: t.lock,
    fontFamily: typography.medium,
  },
});
