import { useState } from "react";
import { PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pathTheme as t } from "@/constants/path-theme";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { PathExploreNode } from "@/lib/api";
import { parsePathAnswer, type PathAnswerBlock } from "./path-answer";

type Props = {
  source: string | null;
  tiles?: PathExploreNode[];
  onOpenTile?: (node: PathExploreNode) => void;
};

function tileIcon(slug: string): keyof typeof Ionicons.glyphMap {
  if (slug.includes("math")) return "calculator-outline";
  if (slug.includes("langlit") || slug.includes("lang-")) return "book-outline";
  if (slug.includes("langacq") || slug.includes("lang") || slug.includes("-r3")) return "language-outline";
  if (slug.includes("world") || slug.includes("sst") || slug.includes("soc")) return "earth-outline";
  if (slug.includes("sci")) return "flask-outline";
  if (slug.includes("art")) return "color-palette-outline";
  if (slug.includes("phe") || slug.includes("health") || slug.includes("internal")) return "fitness-outline";
  if (slug.includes("design") || slug.includes("-ct")) return "extension-puzzle-outline";
  if (slug.includes("society")) return "people-outline";
  if (slug.includes("board") || slug.includes("exam")) return "document-text-outline";
  if (slug.includes("other") || slug.includes("work")) return "construct-outline";
  return "ellipse-outline";
}

function stackColumns(width: number): boolean {
  return width < 360 || PixelRatio.getFontScale() >= 1.25;
}

export function PathAnswerView({ source, tiles, onOpenTile }: Props) {
  const blocks = parsePathAnswer(source);
  const { width } = useWindowDimensions();
  const stack = stackColumns(width);
  const [openMore, setOpenMore] = useState<string | null>(null);
  if (!blocks) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => (
        <Block
          key={`${block.kind}-${index}`}
          block={block}
          stack={stack}
          tiles={tiles}
          onOpenTile={onOpenTile}
          openMore={openMore}
          onToggleMore={(title) => setOpenMore((current) => (current === title ? null : title))}
        />
      ))}
    </View>
  );
}

function Block({
  block,
  stack,
  tiles,
  onOpenTile,
  openMore,
  onToggleMore,
}: {
  block: PathAnswerBlock;
  stack: boolean;
  tiles?: PathExploreNode[];
  onOpenTile?: (node: PathExploreNode) => void;
  openMore: string | null;
  onToggleMore: (title: string) => void;
}) {
  if (block.kind === "lead") {
    return (
      <View style={styles.lead}>
        <Text style={styles.leadText}>{block.text}</Text>
      </View>
    );
  }
  if (block.kind === "text") {
    return <Text style={styles.body}>{block.text}</Text>;
  }
  if (block.kind === "checks") {
    return (
      <View style={styles.block}>
        {block.title ? <Text style={styles.section}>{block.title}</Text> : null}
        {block.items.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="checkmark" size={18} color={colors.primary} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.kind === "compare") {
    return (
      <View style={[styles.columns, stack && styles.columnsStack]}>
        <CompareColumn title={block.leftTitle} rows={block.rows.map((row) => ({ muted: row.muted, text: row.left }))} />
        <CompareColumn title={block.rightTitle} rows={block.rows.map((row) => ({ muted: row.muted, text: row.right }))} />
      </View>
    );
  }
  if (block.kind === "pair") {
    return (
      <View style={[styles.columns, stack && styles.columnsStack]}>
        {block.items.map((item) => (
          <View key={item.title} style={styles.column}>
            <Text style={styles.columnTitle}>{item.title}</Text>
            <Text style={styles.columnBody}>{item.body}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.kind === "facts") {
    return (
      <View style={[styles.columns, stack && styles.columnsStack]}>
        {block.items.map((item) => (
          <View key={`${item.value}-${item.unit}`} style={styles.fact}>
            <Text style={styles.factValue}>{item.value}</Text>
            <Text style={styles.factUnit}>{item.unit}</Text>
            <Text style={styles.factCaption}>{item.caption}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.kind === "steps") {
    return (
      <View style={styles.block}>
        {block.items.map((item, index) => (
          <View key={item.title} style={styles.step}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <View style={styles.stepBody}>
              <Text style={styles.columnTitle}>{item.title}</Text>
              <Text style={styles.columnBody}>{item.body}</Text>
            </View>
            {index < block.items.length - 1 ? <Text style={styles.stepArrow}>→</Text> : null}
          </View>
        ))}
      </View>
    );
  }
  if (block.kind === "callout") {
    return (
      <View style={[styles.callout, block.tone === "ask" && styles.calloutAsk]}>
        <Text style={styles.kicker}>{block.kicker}</Text>
        <Text style={styles.calloutText}>{block.text}</Text>
      </View>
    );
  }
  if (block.kind === "more") {
    const open = openMore === block.title;
    return (
      <View style={styles.more}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => onToggleMore(block.title)}
          style={styles.moreHit}
        >
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={colors.primary} />
          <Text style={styles.moreTitle}>{block.title}</Text>
        </Pressable>
        {open ? <Text style={styles.body}>{block.body}</Text> : null}
      </View>
    );
  }
  if (block.kind === "tiles" && tiles && tiles.length > 0) {
    return (
      <View style={styles.tileGrid}>
        {tiles.map((node) => (
          <Pressable key={node.id} onPress={() => onOpenTile?.(node)} style={styles.tile}>
            <Ionicons name={tileIcon(node.slug)} size={18} color={colors.primary} />
            <Text style={styles.tileTitle}>{node.title}</Text>
            {node.summary ? <Text style={styles.tileSummary}>{node.summary}</Text> : null}
          </Pressable>
        ))}
      </View>
    );
  }
  return null;
}

function CompareColumn({
  title,
  rows,
}: {
  title: string;
  rows: { muted: boolean; text: string }[];
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      {rows.map((row, index) => (
        <Text key={`${row.text}-${index}`} style={row.muted ? styles.muted : styles.columnBody}>
          {row.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.md },
  lead: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  leadText: {
    ...typography.body,
    color: t.title,
    fontFamily: typography.semibold,
  },
  body: {
    ...typography.body,
    color: t.title,
  },
  block: { gap: spacing.sm },
  section: {
    ...typography.body,
    color: t.title,
    fontFamily: typography.semibold,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.panelBorder,
  },
  checkText: {
    ...typography.body,
    flex: 1,
    color: t.title,
  },
  columns: { flexDirection: "row", gap: spacing.sm },
  columnsStack: { flexDirection: "column" },
  column: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  columnTitle: {
    ...typography.body,
    color: t.title,
    fontFamily: typography.semibold,
    marginBottom: 4,
  },
  columnBody: {
    ...typography.body,
    color: t.title,
  },
  muted: {
    ...typography.supporting,
    color: t.deck,
    marginTop: spacing.sm,
  },
  fact: {
    flex: 1,
    minWidth: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  factValue: {
    color: colors.primaryDark,
    fontFamily: typography.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  factUnit: {
    ...typography.supporting,
    color: t.title,
    fontFamily: typography.semibold,
  },
  factCaption: {
    ...typography.supporting,
    color: t.deck,
    textAlign: "center",
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    minHeight: 44,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 28,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  stepBody: { flex: 1, gap: 2 },
  stepArrow: { color: t.dimmed, fontSize: 16, lineHeight: 28 },
  callout: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 6,
  },
  calloutAsk: { backgroundColor: colors.warningSoft },
  kicker: {
    color: colors.warning,
    fontFamily: typography.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  calloutText: {
    ...typography.body,
    color: t.title,
  },
  more: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.panelBorder,
    paddingTop: spacing.sm,
  },
  moreHit: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  moreTitle: {
    ...typography.body,
    flex: 1,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "48%",
    flexGrow: 1,
    minHeight: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: t.panelBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  tileTitle: {
    ...typography.body,
    color: t.title,
    fontFamily: typography.semibold,
  },
  tileSummary: {
    ...typography.supporting,
    color: t.deck,
  },
});
