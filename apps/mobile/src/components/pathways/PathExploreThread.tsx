import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pathTheme as t } from "@/constants/path-theme";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type {
  PathDiscussionLink,
  PathExploreNode,
  PathwayHubChild,
} from "@/lib/api";
import { childSwitcherTabLabel } from "@/lib/child-switcher-label";

const LINE_COLORS = [
  colors.teal,
  colors.navy,
  colors.amber,
  colors.coral,
  colors.lavender,
] as const;

const RAIL = 18;

type Props = {
  locationTitle: string;
  locationMeta: string;
  stateLabel: string;
  lockLine: string;
  postingCircleName: string | null;
  nodes: PathExploreNode[];
  children: PathwayHubChild[];
  selectedChildId: string | null;
  expandedIds: Set<string>;
  discussions: Record<string, PathDiscussionLink[] | "loading" | "error">;
  askingId: string | null;
  askDraft: string;
  askBusy: boolean;
  onMore: () => void;
  onSelectChild: (id: string) => void;
  onToggle: (id: string) => void;
  onOpenDetail: (slug: string, title: string) => void;
  onRead: (id: string) => void;
  onOpenDiscussion: (link: PathDiscussionLink) => void;
  onStartAsk: (node: PathExploreNode) => void;
  onChangeAsk: (text: string) => void;
  onSendAsk: () => void;
  onCancelAsk: () => void;
};

function lineColor(depth: number) {
  return LINE_COLORS[Math.max(depth, 0) % LINE_COLORS.length];
}

function showsActions(node: PathExploreNode, open: boolean) {
  if (node.kind === "root" || node.kind === "section") return false;
  if (!node.allowAsk && !node.allowDiscussions) return false;
  return open || !node.hasChildren;
}

export function PathExploreThread({
  locationTitle,
  locationMeta,
  stateLabel,
  lockLine,
  postingCircleName,
  nodes,
  children,
  selectedChildId,
  expandedIds,
  discussions,
  askingId,
  askDraft,
  askBusy,
  onMore,
  onSelectChild,
  onToggle,
  onOpenDetail,
  onRead,
  onOpenDiscussion,
  onStartAsk,
  onChangeAsk,
  onSendAsk,
  onCancelAsk,
}: Props) {
  const visible = nodes.filter(
    (node) => node.depth === 0 || (node.parentId && expandedIds.has(node.parentId))
  );
  const crumb = nodes
    .filter((node) => expandedIds.has(node.id))
    .sort((a, b) => a.depth - b.depth);

  return (
    <View style={styles.page}>
      <View style={styles.nav}>
        <Text style={styles.wordmark}>vaara</Text>
        <Text style={styles.navTitle}>Child's Path</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={onMore} hitSlop={8}>
          <Text style={styles.navAction}>More</Text>
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
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {childSwitcherTabLabel(child, index)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.eyebrow}>{stateLabel}</Text>
      <Text style={styles.headline}>Explore what comes next</Text>

      <View style={styles.location}>
        <Text style={styles.kicker}>YOUR CHILD IS HERE</Text>
        <Text style={styles.locationTitle}>{locationTitle}</Text>
        <Text style={styles.meta}>{locationMeta}</Text>
      </View>

      {crumb.length > 1 ? (
        <View style={styles.crumbRow}>
          {crumb.map((node, index) => (
            <View key={node.id} style={styles.crumbItem}>
              {index > 0 ? (
                <Ionicons name="chevron-forward" size={12} color={t.kicker} />
              ) : null}
              <Text style={[styles.crumbText, { color: lineColor(node.depth) }]} numberOfLines={1}>
                {node.title}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.tree}>
        {visible.map((node) => {
          const open = expandedIds.has(node.id);
          const discussionState = discussions[node.id];
          const color = lineColor(Math.max(node.depth - 1, 0));
          const body = open ? node.lead || node.summary : node.summary;
          const actions = showsActions(node, open);
          return (
            <View key={node.id} style={styles.threadItem}>
              {node.depth > 0 ? (
                <View style={[styles.rails, { width: node.depth * RAIL }]} pointerEvents="none">
                  {Array.from({ length: node.depth }, (_, level) => (
                    <View key={level} style={styles.railTrack}>
                      <View
                        style={[
                          styles.rail,
                          { backgroundColor: lineColor(level) },
                        ]}
                      />
                    </View>
                  ))}
                  <View
                    style={[
                      styles.branch,
                      {
                        backgroundColor: color,
                        left: (node.depth - 1) * RAIL + RAIL / 2,
                      },
                    ]}
                  />
                </View>
              ) : null}

              <View style={[styles.threadBody, { marginLeft: node.depth * RAIL }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => (node.hasChildren ? onToggle(node.id) : undefined)}
                  style={styles.row}
                >
                  <Ionicons
                    name={
                      node.hasChildren
                        ? open
                          ? "chevron-down"
                          : "chevron-forward"
                        : "ellipse"
                    }
                    size={node.hasChildren ? 16 : 8}
                    color={node.depth === 0 ? lineColor(0) : color}
                  />
                  <View style={styles.rowBody}>
                    {node.kicker ? <Text style={styles.rowKicker}>{node.kicker}</Text> : null}
                    <Text style={styles.rowTitle}>{node.title}</Text>
                    {body && !open ? <Text style={styles.rowSummary}>{body}</Text> : null}
                  </View>
                </Pressable>

                {open && (node.lead || node.summary) ? (
                  <View style={[styles.copy, { borderLeftColor: node.depth === 0 ? lineColor(0) : color }]}>
                    <Text style={styles.copyText}>{node.lead || node.summary}</Text>
                  </View>
                ) : null}

                {node.pathwayItemSlug && (open || !node.hasChildren) ? (
                  <Pressable
                    onPress={() => onOpenDetail(node.pathwayItemSlug!, node.title)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="open-outline" size={16} color={t.textLink} />
                    <Text style={styles.link}>Official details</Text>
                  </Pressable>
                ) : null}

                {actions ? (
                  <View style={styles.actions}>
                    {node.allowDiscussions ? (
                      <Pressable onPress={() => onRead(node.id)} style={styles.actionBtn}>
                        <Ionicons name="chatbubbles-outline" size={16} color={t.textLink} />
                        <Text style={styles.link}>Read discussions</Text>
                      </Pressable>
                    ) : null}
                    {node.allowAsk ? (
                      <Pressable
                        onPress={() => onStartAsk(node)}
                        disabled={!postingCircleName}
                        style={styles.actionBtn}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={postingCircleName ? t.textLink : t.dimmed}
                        />
                        <Text style={[styles.link, !postingCircleName && styles.dim]}>
                          Ask parents
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {askingId === node.id ? (
                  <View style={styles.composer}>
                    {postingCircleName ? (
                      <Text style={styles.where}>Posts in {postingCircleName}</Text>
                    ) : null}
                    <TextInput
                      value={askDraft}
                      onChangeText={onChangeAsk}
                      multiline
                      style={styles.input}
                      placeholder={node.askPrompt || "Your question"}
                      placeholderTextColor={t.dimmed}
                    />
                    <View style={styles.composerRow}>
                      <Pressable onPress={onCancelAsk}><Text style={styles.link}>Cancel</Text></Pressable>
                      <Pressable onPress={onSendAsk} disabled={askBusy || !askDraft.trim()} style={styles.send}>
                        {askBusy ? (
                          <ActivityIndicator color={t.ctaText} />
                        ) : (
                          <Text style={styles.sendText}>Post</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {discussionState === "loading" ? (
                  <ActivityIndicator color={t.navWordmark} />
                ) : null}
                {discussionState === "error" ? (
                  <Text style={styles.meta}>Could not load discussions. Tap Read to retry.</Text>
                ) : null}
                {Array.isArray(discussionState) && discussionState.length === 0 ? (
                  <Text style={styles.meta}>No discussions on this branch yet.</Text>
                ) : null}
                {Array.isArray(discussionState)
                  ? discussionState.map((link) => (
                      <Pressable key={link.messageId} onPress={() => onOpenDiscussion(link)} style={styles.discussion}>
                        <Text style={styles.rowTitle} numberOfLines={2}>{link.preview || "Question"}</Text>
                        <Text style={styles.meta}>
                          {link.circleName}
                          {link.openAs === "thread" ? ` · ${link.replyCount} replies` : " · message"}
                        </Text>
                      </Pressable>
                    ))
                  : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.lockRow}>
        <Ionicons name="lock-closed-outline" size={14} color={t.lock} />
        <Text style={styles.lock}>{lockLine}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.sm, paddingBottom: spacing.xxl },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  wordmark: { ...typography.supporting, color: t.navWordmark, fontFamily: typography.semibold, width: 64 },
  navTitle: { ...typography.body, color: t.navTitle, fontFamily: typography.semibold },
  navAction: { ...typography.supporting, color: t.navAction, fontFamily: typography.semibold, width: 64, textAlign: "right" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  childChip: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.chipIdleBorder,
    backgroundColor: t.chipIdleFill,
  },
  chipOn: { backgroundColor: t.chipActiveFill, borderColor: t.chipActiveFill },
  chipText: { ...typography.caption, color: t.chipIdleText, fontFamily: typography.semibold },
  chipTextOn: { color: t.chipActiveText },
  eyebrow: { ...typography.caption, color: t.eyebrow, fontFamily: typography.medium },
  headline: { ...typography.screenTitle, color: t.title, fontFamily: typography.bold },
  location: {
    borderWidth: 1,
    borderColor: t.nodeBorder,
    backgroundColor: t.nodeFill,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: 4,
  },
  kicker: { ...typography.caption, color: t.kicker, letterSpacing: 0.6, fontFamily: typography.bold },
  locationTitle: { ...typography.sectionTitle, color: t.nodeTitle, fontFamily: typography.bold },
  meta: { ...typography.supporting, color: t.nodeMeta },
  crumbRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  crumbItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  crumbText: { ...typography.caption, fontFamily: typography.semibold },
  tree: { marginTop: spacing.xs },
  threadItem: { position: "relative", minHeight: 36 },
  rails: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  railTrack: { width: RAIL, alignItems: "center" },
  rail: { width: 2, flex: 1, borderRadius: 1 },
  branch: {
    position: "absolute",
    top: 18,
    width: RAIL / 2,
    height: 2,
    borderRadius: 1,
  },
  threadBody: { paddingBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start", minHeight: 36, paddingTop: 8 },
  rowBody: { flex: 1, gap: 2 },
  rowKicker: { ...typography.caption, color: t.kicker, fontFamily: typography.semibold },
  rowTitle: { ...typography.body, color: t.title, fontFamily: typography.semibold },
  rowSummary: { ...typography.supporting, color: t.deck },
  copy: {
    marginLeft: 22,
    marginTop: 4,
    marginBottom: 6,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
  },
  copyText: { ...typography.supporting, color: t.title, lineHeight: 20 },
  actions: { marginLeft: 22, gap: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingVertical: 2,
    marginLeft: 22,
  },
  link: { ...typography.supporting, color: t.textLink, fontFamily: typography.semibold },
  dim: { color: t.dimmed },
  where: { ...typography.caption, color: t.lock },
  composer: { marginLeft: 22, gap: spacing.xs, marginTop: 4 },
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
  composerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  send: { backgroundColor: t.ctaFill, borderRadius: radii.pill, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center" },
  sendText: { color: t.ctaText, fontFamily: typography.semibold },
  discussion: {
    marginLeft: 22,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.md,
    backgroundColor: t.panelFill,
    gap: 2,
  },
  lockRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: spacing.md },
  lock: { ...typography.caption, color: t.lock, flex: 1 },
});
