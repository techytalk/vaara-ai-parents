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
import { radii, spacing, typography } from "@/constants/theme";
import type {
  PathDiscussionLink,
  PathExploreNode,
  PathwayHubChild,
} from "@/lib/api";
import { childSwitcherTabLabel } from "@/lib/child-switcher-label";

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
  const breadcrumb = nodes
    .filter((node) => node.depth > 0 && expandedIds.has(node.id))
    .sort((a, b) => a.depth - b.depth)
    .map((node) => node.title)
    .join("  /  ");

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

      {breadcrumb ? <Text style={styles.crumb}>{breadcrumb}</Text> : null}

      {visible.map((node) => {
        const open = expandedIds.has(node.id);
        const discussionState = discussions[node.id];
        return (
          <View key={node.id} style={{ marginLeft: Math.min(node.depth, 4) * 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => (node.hasChildren ? onToggle(node.id) : undefined)}
              style={styles.row}
            >
              <Ionicons
                name={node.hasChildren ? (open ? "chevron-down" : "chevron-forward") : "ellipse"}
                size={node.hasChildren ? 16 : 8}
                color={t.kicker}
              />
              <View style={styles.rowBody}>
                {node.kicker ? <Text style={styles.rowKicker}>{node.kicker}</Text> : null}
                <Text style={styles.rowTitle}>{node.title}</Text>
                {node.summary ? <Text style={styles.rowSummary}>{node.summary}</Text> : null}
              </View>
            </Pressable>

            {node.pathwayItemSlug ? (
              <Pressable onPress={() => onOpenDetail(node.pathwayItemSlug!, node.title)}>
                <Text style={styles.link}>Official details</Text>
              </Pressable>
            ) : null}

            {(open || !node.hasChildren) && (node.allowAsk || node.allowDiscussions) ? (
              <View style={styles.actions}>
                {node.allowDiscussions ? (
                  <Pressable onPress={() => onRead(node.id)}>
                    <Text style={styles.link}>Read parent discussions</Text>
                  </Pressable>
                ) : null}
                {node.allowAsk ? (
                  <Pressable onPress={() => onStartAsk(node)} disabled={!postingCircleName}>
                    <Text style={[styles.link, !postingCircleName && styles.dim]}>
                      Ask parents anonymously
                    </Text>
                  </Pressable>
                ) : null}
                {postingCircleName && (open || !node.hasChildren) ? (
                  <Text style={styles.where}>Where will this be posted? {postingCircleName}</Text>
                ) : null}
              </View>
            ) : null}

            {askingId === node.id ? (
              <View style={styles.composer}>
                <TextInput
                  value={askDraft}
                  onChangeText={onChangeAsk}
                  multiline
                  style={styles.input}
                  placeholder="Your question"
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
        );
      })}

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
  crumb: { ...typography.caption, color: t.kicker },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", minHeight: 44, paddingVertical: 6 },
  rowBody: { flex: 1, gap: 2 },
  rowKicker: { ...typography.caption, color: t.kicker, fontFamily: typography.semibold },
  rowTitle: { ...typography.body, color: t.title, fontFamily: typography.semibold },
  rowSummary: { ...typography.supporting, color: t.deck },
  actions: { gap: 4, marginLeft: 24, marginBottom: spacing.xs },
  link: { ...typography.supporting, color: t.textLink, fontFamily: typography.semibold, paddingVertical: 4 },
  dim: { opacity: 0.4 },
  where: { ...typography.caption, color: t.lock },
  composer: { marginLeft: 24, gap: spacing.xs },
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
    marginLeft: 24,
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
