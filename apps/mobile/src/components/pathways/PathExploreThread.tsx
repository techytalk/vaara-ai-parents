import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pathTheme as t } from "@/constants/path-theme";
import { colors, radii, shadows, spacing, typography } from "@/constants/theme";
import type {
  PathDiscussionLink,
  PathExploreNode,
  PathwayHubChild,
} from "@/lib/api";
import { useAndroidImeDockOffset, useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { childSwitcherTabLabel } from "@/lib/child-switcher-label";
import { PathAnswerView } from "./PathAnswerView";
import { answerOpensAsPage, parsePathAnswer } from "./path-answer";

const THREAD = colors.primary;
const RAIL = 20;

type StageTab = {
  id: string;
  line1: string;
  line2: string;
};

type Props = {
  locationTitle: string;
  stateLabel: string;
  postingCircleName: string | null;
  children: PathwayHubChild[];
  selectedChildId: string | null;
  stageTabs: StageTab[];
  activeStageId: string | null;
  focus: PathExploreNode;
  breadcrumb: PathExploreNode[];
  cards: PathExploreNode[];
  nestedByParent: Record<string, PathExploreNode[]>;
  expandedIds: Set<string>;
  discussions: PathDiscussionLink[] | "loading" | "error" | undefined;
  asking: boolean;
  askDraft: string;
  askBusy: boolean;
  contentRefreshing?: boolean;
  backLabel?: string;
  onBack: () => void;
  onSelectChild: (id: string) => void;
  onSelectStage: (id: string) => void;
  onOpenCard: (node: PathExploreNode) => void;
  onToggleExpand: (id: string) => void;
  onLevelUp: () => void;
  onOpenDetail: (slug: string, title: string) => void;
  onRead: () => void;
  onOpenDiscussion: (link: PathDiscussionLink) => void;
  onStartAsk: () => void;
  onChangeAsk: (text: string) => void;
  onSendAsk: () => void;
  onCancelAsk: () => void;
};

function parseCompareTable(block: string): string[][] | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines.every((line) => line.startsWith("|") && line.endsWith("|"))) {
    return null;
  }
  const rows = lines
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim())
    )
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
  return rows.length >= 2 ? rows : null;
}

function stageEyebrow(focus: PathExploreNode, isStageRoot: boolean) {
  if (!isStageRoot) return null;
  const kick = (focus.kicker ?? "").toLowerCase();
  if (kick.includes("this year") || focus.slug.includes("-now")) return "YOUR CHILD NOW";
  if (kick.includes("next")) return "EXPLORING AHEAD";
  if (kick.includes("explore") || kick.includes("after")) return "EXPLORING AHEAD";
  return "EXPLORING AHEAD";
}

export function PathExploreThread({
  locationTitle,
  stateLabel,
  postingCircleName,
  children,
  selectedChildId,
  stageTabs,
  activeStageId,
  focus,
  breadcrumb,
  cards,
  nestedByParent,
  expandedIds,
  discussions,
  asking,
  askDraft,
  askBusy,
  contentRefreshing = false,
  backLabel = "Back",
  onBack,
  onSelectChild,
  onSelectStage,
  onOpenCard,
  onToggleExpand,
  onLevelUp,
  onOpenDetail,
  onRead,
  onOpenDiscussion,
  onStartAsk,
  onChangeAsk,
  onSendAsk,
  onCancelAsk,
}: Props) {
  const isStageRoot = stageTabs.some((tab) => tab.id === focus.id);
  const eyebrow = stageEyebrow(focus, isStageRoot);
  const showLevelUp = breadcrumb.length > 1;
  const unsure = cards.find((node) => /unsure|not sure/i.test(node.title));
  const visibleCards = cards.filter((node) => node.id !== unsure?.id);
  const canAsk = focus.allowAsk;
  const canRead = focus.allowDiscussions;
  const isLeaf = visibleCards.length === 0 && !isStageRoot;
  const answerBlocks = parsePathAnswer(focus.lead);
  const tileCards = answerBlocks?.some((block) => block.kind === "tiles")
    ? visibleCards.filter((node) => node.kind !== "section")
    : [];
  const listCards =
    tileCards.length > 0
      ? visibleCards.filter((node) => node.kind === "section")
      : visibleCards;
  const leafAnswer = isLeaf && !answerBlocks ? focus.lead || focus.summary : null;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef<Record<string, number>>({});
  const discussionsBefore = useRef(discussions);
  const keyboardHeight = useKeyboardHeight();
  const androidLift = useAndroidImeDockOffset(0);
  const keyboardLift = Platform.OS === "ios" ? keyboardHeight : androidLift;

  useEffect(() => {
    const y = scrollY.current[focus.id] ?? 0;
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [focus.id]);

  useEffect(() => {
    const before = discussionsBefore.current;
    discussionsBefore.current = discussions;
    if (before == null && (discussions === "loading" || Array.isArray(discussions))) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [discussions]);

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          asking && styles.scrollAsking,
          keyboardLift > 0 && { paddingBottom: 128 + keyboardLift },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollY.current[focus.id] = event.nativeEvent.contentOffset.y;
        }}
      >
      <View style={styles.nav}>
        <Text style={styles.wordmark}>vaara</Text>
        <Text style={styles.navTitle}>Child's Path</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${backLabel}`} onPress={onBack} hitSlop={8}>
          <Text style={styles.navAction}>‹ {backLabel}</Text>
        </Pressable>
      </View>

      {children.length > 1 ? (
        <View style={styles.chips}>
          {children.map((child, index) => {
            const selected = child.id === selectedChildId;
            return (
              <Pressable
                key={child.id}
                onPress={() => onSelectChild(child.id)}
                style={[styles.childChip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={2}>
                  {childSwitcherTabLabel(child, index)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.here}>
        <View style={styles.hereDot} />
        <View style={styles.hereBody}>
          <Text style={styles.hereTitle}>{locationTitle}</Text>
          <Text style={styles.hereMeta}>Current stage · {stateLabel}</Text>
        </View>
      </View>

      {stageTabs.length > 1 ? (
        <View style={styles.stageRow}>
          {stageTabs.map((tab) => {
            const on = tab.id === activeStageId;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onSelectStage(tab.id)}
                style={[styles.stageTab, on && styles.stageTabOn]}
              >
                <Text style={[styles.stageLine1, on && styles.stageLineOn]} numberOfLines={1}>
                  {tab.line1}
                </Text>
                <Text style={[styles.stageLine2, on && styles.stageLineOn]} numberOfLines={2}>
                  {tab.line2}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {contentRefreshing ? (
        <ActivityIndicator color={t.navWordmark} style={styles.refreshing} />
      ) : null}

      {showLevelUp ? (
        <View style={styles.crumbBlock}>
          <Text style={styles.crumbPath} numberOfLines={2}>
            {breadcrumb
              .slice(0, -1)
              .map((node) => node.title)
              .join("  ›  ")}
          </Text>
          <Pressable onPress={onLevelUp} hitSlop={8}>
            <Text style={styles.levelUp}>← One level up</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.pane, isLeaf && styles.paneLeaf]}>
        {eyebrow ? <Text style={styles.paneEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.paneTitle}>{focus.title}</Text>
        {answerBlocks ? (
          <PathAnswerView source={focus.lead} tiles={tileCards} onOpenTile={onOpenCard} />
        ) : isLeaf && leafAnswer ? (
          <View style={styles.answerLines}>
            {leafAnswer.split(/\n\n+/).map((block, index) => {
              const table = parseCompareTable(block);
              if (!table) {
                return (
                  <Text key={`${index}-text`} style={styles.paneAnswer}>
                    {block}
                  </Text>
                );
              }
              return (
                <View key={`${index}-table`} style={styles.compare}>
                  {table.map((row, rowIndex) => (
                    <View
                      key={`${index}-row-${rowIndex}`}
                      style={[styles.compareRow, rowIndex === 0 && styles.compareHead]}
                    >
                      {row.map((cell, cellIndex) => (
                        <View
                          key={`${index}-${rowIndex}-${cellIndex}`}
                          style={[
                            styles.compareCell,
                            cellIndex === 0 ? styles.compareLabel : styles.compareValue,
                            cellIndex === row.length - 1 && styles.compareLast,
                          ]}
                        >
                          <Text
                            style={
                              rowIndex === 0 || cellIndex === 0
                                ? styles.compareStrong
                                : styles.compareText
                            }
                          >
                            {cell}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <>
            {focus.summary || focus.lead ? (
              <Text style={styles.paneDeck}>{focus.summary || focus.lead}</Text>
            ) : null}
            {focus.lead && focus.summary && focus.lead !== focus.summary && !isStageRoot ? (
              <Text style={styles.paneLead}>{focus.lead}</Text>
            ) : null}
          </>
        )}
      </View>

      {listCards.length > 0 ? (
        <View style={styles.thread}>
          <View style={styles.threadRail} />
          {listCards.map((node) => {
            const nested = nestedByParent[node.id] ?? [];
            const expandable =
              nested.length > 0 && node.kind === "section" && !answerOpensAsPage(node.lead);
            const open = expandedIds.has(node.id);
            return (
              <View key={node.id} style={styles.threadItem}>
                <View style={styles.threadBranch} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandable ? open : undefined }}
                  onPress={() =>
                    expandable ? onToggleExpand(node.id) : onOpenCard(node)
                  }
                  style={[styles.card, open && styles.cardOpen]}
                >
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{node.title}</Text>
                    {node.summary ? (
                      <Text style={styles.cardSummary} numberOfLines={2}>
                        {node.summary}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={expandable ? (open ? "remove" : "add") : "chevron-forward"}
                    size={18}
                    color={t.kicker}
                  />
                </Pressable>

                {expandable && open ? (
                  <View style={styles.nested}>
                    <View style={styles.nestedRail} />
                    {nested.map((child) => (
                      <View key={child.id} style={styles.nestedItem}>
                        <View style={styles.nestedBranch} />
                        <Pressable
                          onPress={() => onOpenCard(child)}
                          style={styles.nestedRow}
                        >
                          <Text style={styles.nestedTitle}>{child.title}</Text>
                          <Ionicons name="chevron-forward" size={16} color={t.kicker} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {unsure ? (
        <Pressable onPress={() => onOpenCard(unsure)} style={styles.unsure}>
          <Text style={styles.unsureText}>Not sure yet? Ask about the options →</Text>
        </Pressable>
      ) : null}

      {focus.pathwayItemSlug ? (
        <Pressable
          onPress={() => onOpenDetail(focus.pathwayItemSlug!, focus.title)}
          style={styles.official}
        >
          <Ionicons name="open-outline" size={16} color={t.textLink} />
          <Text style={styles.link}>Official information</Text>
        </Pressable>
      ) : null}

      {discussions != null ? (
        <View style={styles.footer}>
          {discussions === "loading" ? <ActivityIndicator color={t.navWordmark} /> : null}
          {discussions === "error" ? (
            <Text style={styles.meta}>Could not load discussions. Tap Read to retry.</Text>
          ) : null}
          {Array.isArray(discussions) && discussions.length === 0 ? (
            <Text style={styles.meta}>No discussions on this branch yet.</Text>
          ) : null}
          {Array.isArray(discussions)
            ? discussions.map((link) => (
                <Pressable
                  key={link.messageId}
                  onPress={() => onOpenDiscussion(link)}
                  style={styles.discussion}
                >
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {link.preview || "Question"}
                  </Text>
                  <Text style={styles.meta}>
                    {link.circleName}
                    {link.openAs === "thread" ? ` · ${link.replyCount} replies` : " · message"}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}
      </ScrollView>

      {canRead || canAsk ? (
        <View style={[styles.dock, keyboardLift > 0 && { bottom: spacing.sm + keyboardLift }]}>
          {asking ? (
            <View style={styles.composer}>
              {postingCircleName ? (
                <Text style={styles.where}>Posts in {postingCircleName}</Text>
              ) : null}
              <TextInput
                value={askDraft}
                onChangeText={onChangeAsk}
                multiline
                style={styles.input}
                placeholder={focus.askPrompt || "Your question"}
                placeholderTextColor={t.dimmed}
              />
              <View style={styles.composerRow}>
                <Pressable onPress={onCancelAsk}>
                  <Text style={styles.link}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onSendAsk}
                  disabled={askBusy || !askDraft.trim()}
                  style={styles.send}
                >
                  {askBusy ? (
                    <ActivityIndicator color={t.ctaText} />
                  ) : (
                    <Text style={styles.sendText}>Post</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.ctaRow}>
            {canRead ? (
              <Pressable onPress={onRead} style={styles.ctaSecondary}>
                <Ionicons name="chatbubbles-outline" size={18} color={t.textLink} />
                <Text style={styles.ctaSecondaryText}>Read discussions</Text>
              </Pressable>
            ) : null}
            {canAsk ? (
              <Pressable
                onPress={onStartAsk}
                disabled={!postingCircleName}
                style={[styles.ctaPrimary, !postingCircleName && styles.ctaDisabled]}
              >
                <Ionicons name="create-outline" size={18} color={t.ctaText} />
                <Text style={styles.ctaPrimaryText}>Ask parents</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: 128,
  },
  scrollAsking: { paddingBottom: 280 },
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
    width: 72,
  },
  navTitle: { ...typography.body, color: t.navTitle, fontFamily: typography.semibold },
  navAction: {
    ...typography.supporting,
    color: t.navAction,
    fontFamily: typography.semibold,
    width: 72,
    textAlign: "right",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  childChip: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.chipIdleBorder,
    backgroundColor: t.chipIdleFill,
  },
  chipOn: { borderColor: t.ctaFill, backgroundColor: t.chipIdleFill },
  chipText: { ...typography.caption, color: t.chipIdleText, fontFamily: typography.semibold },
  chipTextOn: { color: t.chipActiveText },
  here: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: 4 },
  hereDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  hereBody: { flex: 1, gap: 2 },
  hereTitle: { ...typography.sectionTitle, color: t.title, fontFamily: typography.bold },
  hereMeta: { ...typography.supporting, color: t.deck },
  stageRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  refreshing: { marginTop: spacing.sm },
  stageTab: {
    flex: 1,
    minHeight: 58,
    borderRadius: radii.lg,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  stageTabOn: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryLight },
  stageLine1: { ...typography.caption, color: t.deck, fontFamily: typography.semibold },
  stageLine2: { ...typography.supporting, color: t.title, fontFamily: typography.semibold },
  stageLineOn: { color: colors.primaryDark },
  crumbBlock: { gap: 4, marginTop: 2 },
  crumbPath: { ...typography.caption, color: t.textLink, fontFamily: typography.semibold },
  levelUp: { ...typography.supporting, color: t.textLink, fontFamily: typography.semibold },
  pane: { gap: 8, marginTop: 8 },
  paneLeaf: { gap: 14, marginTop: 12 },
  paneEyebrow: {
    ...typography.caption,
    color: t.kicker,
    letterSpacing: 0.7,
    fontFamily: typography.bold,
  },
  paneTitle: { ...typography.screenTitle, color: t.title, fontFamily: typography.bold },
  paneDeck: { ...typography.body, color: t.deck, lineHeight: 24 },
  paneLead: { ...typography.body, color: t.title, fontSize: 17, lineHeight: 26, marginTop: 8 },
  answerLines: { gap: 16 },
  paneAnswer: { ...typography.body, color: t.title },
  compare: {
    borderWidth: 1,
    borderColor: t.nodeBorder,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: t.nodeFill,
  },
  compareRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.nodeBorder,
  },
  compareHead: {
    borderTopWidth: 0,
    backgroundColor: colors.primarySoft,
  },
  compareCell: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: "center",
  },
  compareLabel: {
    flex: 0.85,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: t.nodeBorder,
  },
  compareValue: {
    flex: 1.15,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: t.nodeBorder,
  },
  compareLast: { borderRightWidth: 0 },
  compareStrong: {
    ...typography.supporting,
    color: t.title,
    fontFamily: typography.bold,
    lineHeight: 18,
  },
  compareText: {
    ...typography.supporting,
    color: t.title,
    lineHeight: 18,
  },
  thread: { position: "relative", marginTop: spacing.xs, paddingLeft: RAIL },
  threadRail: {
    position: "absolute",
    left: 7,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: THREAD,
    borderRadius: 1,
  },
  threadItem: { marginBottom: spacing.sm, position: "relative" },
  threadBranch: {
    position: "absolute",
    left: -RAIL + 7,
    top: 24,
    width: RAIL - 7,
    height: 2,
    backgroundColor: THREAD,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.nodeBorder,
    backgroundColor: t.nodeFill,
  },
  cardOpen: { borderColor: colors.primaryLight, backgroundColor: colors.primarySoft },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...typography.body, color: t.title, fontFamily: typography.semibold },
  cardSummary: { ...typography.supporting, color: t.deck },
  nested: { marginTop: spacing.xs, marginLeft: spacing.md, position: "relative", paddingLeft: 14 },
  nestedRail: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: 1,
  },
  nestedItem: { position: "relative", marginBottom: 2 },
  nestedBranch: {
    position: "absolute",
    left: -14,
    top: 20,
    width: 14,
    height: 2,
    backgroundColor: colors.primaryLight,
  },
  nestedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 8,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.panelBorder,
  },
  nestedTitle: { ...typography.body, color: t.title, flex: 1, paddingRight: 8 },
  unsure: { paddingVertical: spacing.xs },
  unsureText: { ...typography.supporting, color: t.textLink, fontFamily: typography.semibold },
  official: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
  },
  link: { ...typography.supporting, color: t.textLink, fontFamily: typography.semibold },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  dock: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: t.panelBorder,
    ...shadows.floating,
  },
  ctaRow: { flexDirection: "row", gap: spacing.sm },
  ctaSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: t.panelFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  ctaSecondaryText: {
    ...typography.body,
    color: t.textLink,
    fontFamily: typography.semibold,
  },
  ctaPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: t.ctaFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaPrimaryText: {
    ...typography.body,
    color: t.ctaText,
    fontFamily: typography.semibold,
  },
  composer: { gap: spacing.xs },
  where: { ...typography.caption, color: t.lock },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.md,
    padding: spacing.sm,
    color: t.title,
    backgroundColor: t.panelFill,
    textAlignVertical: "top",
  },
  composerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  send: {
    backgroundColor: t.ctaFill,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: "center",
  },
  sendText: { color: t.ctaText, fontFamily: typography.semibold },
  discussion: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.md,
    backgroundColor: t.panelFill,
    gap: 2,
  },
  meta: { ...typography.supporting, color: t.nodeMeta },
});
