import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/components/circles/ui";
import { SearchField } from "@/components/ui";
import type { Circle } from "@/lib/api";
import { circleCardSubtitle, circleCardTitle } from "@/lib/circle-display";

export type TopicOption = { slug: string; name: string };

export const MAX_ADDITIONAL_CIRCLES = 4;
export const MAX_TOPICS = 3;

function circleTypeLabel(circle: Circle): string {
  switch (circle.circleType) {
    case "school_class":
      return "Class";
    case "class":
      return "Grade";
    case "locality":
      return "Area";
    case "curriculum":
      return "Curriculum";
    case "community":
      return "Community";
    default:
      return "School";
  }
}

/** Short label for the composer pill, e.g. "Grade 6 +2". */
export function audienceSummary(params: {
  primaryCircle?: Circle;
  primaryLabel: string;
  selectedIds: string[];
}): string {
  const base = params.primaryCircle
    ? circleCardTitle(params.primaryCircle)
    : params.primaryLabel;
  return params.selectedIds.length > 0
    ? `${base} +${params.selectedIds.length}`
    : base;
}

function SheetHeader({
  title,
  subtitle,
  onDone,
}: {
  title: string;
  subtitle: string;
  onDone: () => void;
}) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetHeaderCopy}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.sheetSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Done, ${title}`}
        hitSlop={10}
        onPress={onDone}
        style={styles.doneBtn}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

export function AudienceSheet({
  visible,
  onClose,
  primaryCircle,
  primaryLabel,
  circles,
  selectedIds,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  primaryCircle?: Circle;
  primaryLabel: string;
  circles: Circle[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const optionalCircles = circles.filter((c) => c.id !== primaryCircle?.id);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    if (selectedIds.length >= MAX_ADDITIONAL_CIRCLES) return;
    onChange([...selectedIds, id]);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <SheetHeader
          title="Share with"
          subtitle={`${selectedIds.length + 1} of ${MAX_ADDITIONAL_CIRCLES + 1} circles`}
          onDone={onClose}
        />

        <FlatList
          data={optionalCircles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={[styles.row, styles.rowLocked]}>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Ionicons
                    name="lock-closed"
                    size={13}
                    color={theme.primaryDark}
                  />
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {primaryCircle
                      ? circleCardTitle(primaryCircle)
                      : primaryLabel}
                  </Text>
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {primaryCircle
                    ? circleCardSubtitle(primaryCircle)
                    : "Always included"}
                </Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={theme.primary}
              />
            </View>
          }
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            const disabled =
              !selected && selectedIds.length >= MAX_ADDITIONAL_CIRCLES;
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                style={[styles.row, disabled && styles.rowDisabled]}
                onPress={() => toggle(item.id)}
                disabled={disabled}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {circleTypeLabel(item)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowTitle,
                        disabled && styles.rowTitleDisabled,
                      ]}
                      numberOfLines={2}
                    >
                      {circleCardTitle(item)}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {circleCardSubtitle(item)}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? "checkbox" : "square-outline"}
                  size={22}
                  color={
                    disabled
                      ? theme.tabInactive
                      : selected
                        ? theme.primary
                        : theme.textMuted
                  }
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No other circles yet. Join more from Circles.
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

export function TopicsSheet({
  visible,
  onClose,
  topics,
  selectedSlugs,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  topics: TopicOption[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((topic) => topic.name.toLowerCase().includes(q));
  }, [query, topics]);

  function toggle(slug: string) {
    if (selectedSlugs.includes(slug)) {
      onChange(selectedSlugs.filter((s) => s !== slug));
      return;
    }
    if (selectedSlugs.length >= MAX_TOPICS) return;
    onChange([...selectedSlugs, slug]);
  }

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <SheetHeader
          title="Add topics"
          subtitle={`${selectedSlugs.length} of ${MAX_TOPICS} selected · helps parents find your post`}
          onDone={close}
        />

        <View style={styles.searchWrap}>
          <SearchField
            placeholder="Search topics"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.slug}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = selectedSlugs.includes(item.slug);
            const disabled = !selected && selectedSlugs.length >= MAX_TOPICS;
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                style={[styles.row, disabled && styles.rowDisabled]}
                onPress={() => toggle(item.slug)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.topicName,
                    disabled && styles.rowTitleDisabled,
                  ]}
                >
                  {item.name}
                </Text>
                <Ionicons
                  name={selected ? "checkbox" : "square-outline"}
                  size={22}
                  color={
                    disabled
                      ? theme.tabInactive
                      : selected
                        ? theme.primary
                        : theme.textMuted
                  }
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No topics match your search.</Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: theme.bg },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  sheetHeaderCopy: { flex: 1 },
  sheetTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: theme.text,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  doneBtn: { minHeight: 44, justifyContent: "center" },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.primary,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLocked: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primaryLight,
    marginBottom: 4,
  },
  rowDisabled: { opacity: 0.5 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  rowTitleDisabled: { color: theme.textMuted },
  rowMeta: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
  },
  badge: {
    backgroundColor: theme.borderLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
  },
  topicName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.text,
  },
  emptyText: {
    textAlign: "center",
    color: theme.textMuted,
    fontSize: 14,
    paddingVertical: 24,
  },
});
