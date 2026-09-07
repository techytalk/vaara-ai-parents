import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  POST_TAGS,
  theme,
  type PostTagValue,
} from "@/components/circles/ui";
import { SearchField } from "@/components/ui";
import {
  api,
  type Circle,
  type CircleDirectoryItem,
  type GuestQuota,
} from "@/lib/api";
import { circleCardSubtitle, circleCardTitle } from "@/lib/circle-display";
import { getToken } from "@/lib/session";

export type TopicOption = { slug: string; name: string };

export const MAX_GUEST_CIRCLES = 5;
export const MAX_ADDITIONAL_CIRCLES = 50;
export const MAX_TOPICS = 3;

export type AudienceSelection = {
  id: string;
  displayName: string;
  subtitle: string | null;
  circleType: string;
  accessMode: "member" | "guest";
};

function circleTypeLabel(circleType: string): string {
  switch (circleType) {
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

function AccessBadge({ mode }: { mode: "member" | "guest" }) {
  return (
    <View
      style={[
        styles.accessBadge,
        mode === "guest" ? styles.accessBadgeGuest : styles.accessBadgeMember,
      ]}
    >
      <Text
        style={[
          styles.accessBadgeText,
          mode === "guest"
            ? styles.accessBadgeTextGuest
            : styles.accessBadgeTextMember,
        ]}
      >
        {mode === "guest" ? "GUEST" : "MEMBER"}
      </Text>
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
  locked = false,
  guestQuota,
  onGuestQuotaChange,
}: {
  visible: boolean;
  onClose: () => void;
  primaryCircle?: Circle;
  primaryLabel: string;
  circles: Circle[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  locked?: boolean;
  guestQuota?: GuestQuota | null;
  onGuestQuotaChange?: (quota: GuestQuota) => void;
}) {
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<CircleDirectoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const primaryId = primaryCircle?.id;

  const myCircles = useMemo(() => {
    return circles.filter((c) => c.id !== primaryId);
  }, [circles, primaryId]);

  const filteredMyCircles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return myCircles;
    return myCircles.filter((circle) => {
      const title = circleCardTitle(circle).toLowerCase();
      const subtitle = circleCardSubtitle(circle).toLowerCase();
      return title.includes(q) || subtitle.includes(q);
    });
  }, [myCircles, query]);

  const selectedExtras = useMemo(() => {
    const fromMine = myCircles
      .filter((c) => selectedIds.includes(c.id))
      .map(
        (c): AudienceSelection => ({
          id: c.id,
          displayName: circleCardTitle(c),
          subtitle: circleCardSubtitle(c),
          circleType: c.circleType,
          accessMode: "member",
        })
      );
    const fromDirectory = directory
      .filter((c) => selectedIds.includes(c.id))
      .map(
        (c): AudienceSelection => ({
          id: c.id,
          displayName: c.displayName,
          subtitle: c.subtitle,
          circleType: c.circleType,
          accessMode: "guest",
        })
      );
    const known = new Set([...fromMine, ...fromDirectory].map((c) => c.id));
    const orphans = selectedIds
      .filter((id) => !known.has(id))
      .map(
        (id): AudienceSelection => ({
          id,
          displayName: "Selected circle",
          subtitle: null,
          circleType: "school",
          accessMode: "guest",
        })
      );
    return [...fromMine, ...fromDirectory, ...orphans];
  }, [directory, myCircles, selectedIds]);

  const guestSelected = selectedExtras.filter(
    (item) => item.accessMode === "guest"
  ).length;
  const guestAtMax = guestSelected >= MAX_GUEST_CIRCLES;
  const selectedCount = selectedIds.length + 1;

  const otherCircles = useMemo(() => {
    const selected = new Set(selectedIds);
    return directory.filter(
      (item) => item.id !== primaryId && !selected.has(item.id)
    );
  }, [directory, primaryId, selectedIds]);

  useEffect(() => {
    if (!visible || locked) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchError(null);
        try {
          const token = await getToken();
          if (!token || cancelled) return;
          const result = await api.searchCircleDirectory(token, {
            q: query.trim() || undefined,
            limit: 40,
          });
          if (cancelled) return;
          setDirectory(result.circles);
          onGuestQuotaChange?.(result.guestQuota);
        } catch (cause) {
          if (!cancelled) {
            setSearchError(
              cause instanceof Error
                ? cause.message
                : "Could not search circles"
            );
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [visible, locked, query, onGuestQuotaChange]);

  function toggle(id: string, accessMode: "member" | "guest") {
    if (locked) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    if (accessMode === "guest") {
      if (guestAtMax) return;
      if (
        guestQuota &&
        guestQuota.remaining <= guestSelected
      ) {
        return;
      }
    }
    onChange([...selectedIds, id]);
  }

  function close() {
    setQuery("");
    onClose();
  }

  const quotaLine =
    guestQuota != null
      ? `${Math.max(0, guestQuota.remaining - guestSelected)} of ${guestQuota.limit} guest circle posts remaining today`
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <SheetHeader
          title="Post to circles"
          subtitle={
            locked
              ? "Circles can’t be changed after posting."
              : `Your circles are unlimited. You can also add up to ${MAX_GUEST_CIRCLES} other circles as guest. Guest posts do not open that circle’s feed or members.`
          }
          onDone={close}
        />

        {!locked ? (
          <View style={styles.searchWrap}>
            <SearchField
              placeholder="Search all circles"
              value={query}
              onChangeText={setQuery}
            />
            <Text style={styles.counterText}>
              {selectedCount} selected · {guestSelected} of {MAX_GUEST_CIRCLES}{" "}
              guest circles
            </Text>
            {quotaLine ? (
              <Text style={styles.quotaText}>{quotaLine}</Text>
            ) : null}
            {guestAtMax ? (
              <Text style={styles.hintText}>
                Maximum guest circles selected. Remove one to choose another.
              </Text>
            ) : null}
          </View>
        ) : null}

        <FlatList
          data={[
            ...selectedExtras.map((item) => ({
              kind: "selected" as const,
              item,
            })),
            ...filteredMyCircles
              .filter((c) => !selectedIds.includes(c.id))
              .map((item) => ({ kind: "mine" as const, item })),
            ...otherCircles.map((item) => ({
              kind: "other" as const,
              item,
            })),
          ]}
          keyExtractor={(row) => `${row.kind}-${row.item.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={[styles.row, styles.rowLocked]}>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <AccessBadge mode="member" />
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {primaryCircle
                      ? circleCardTitle(primaryCircle)
                      : primaryLabel}
                  </Text>
                </View>
                <Text style={styles.rowMeta} numberOfLines={2}>
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
          renderItem={({ item: row, index }) => {
            if (row.kind === "selected") {
              const item = row.item;
              return (
                <View>
                  {index === 0 ? (
                    <Text style={styles.sectionTitle}>Selected</Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true, disabled: locked }}
                    style={styles.row}
                    onPress={() => toggle(item.id, item.accessMode)}
                    disabled={locked}
                  >
                    <View style={styles.rowMain}>
                      <View style={styles.rowTop}>
                        <AccessBadge mode={item.accessMode} />
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {circleTypeLabel(item.circleType)}
                          </Text>
                        </View>
                        <Text style={styles.rowTitle} numberOfLines={2}>
                          {item.displayName}
                        </Text>
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {item.accessMode === "guest"
                          ? "Guest · You can access only your post and replies"
                          : item.subtitle ?? "Member circle"}
                      </Text>
                    </View>
                    <Ionicons
                      name="checkbox"
                      size={22}
                      color={theme.primary}
                    />
                  </Pressable>
                </View>
              );
            }

            if (row.kind === "mine") {
              const item = row.item;
              const selected = selectedIds.includes(item.id);
              const disabled = locked;
              return (
                <View>
                  {index === selectedExtras.length ? (
                    <Text style={styles.sectionTitle}>My circles</Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled }}
                    style={[styles.row, disabled && styles.rowDisabled]}
                    onPress={() => toggle(item.id, "member")}
                    disabled={disabled}
                  >
                    <View style={styles.rowMain}>
                      <View style={styles.rowTop}>
                        <AccessBadge mode="member" />
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {circleTypeLabel(item.circleType)}
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
                </View>
              );
            }

            const item = row.item;
            const otherStart =
              selectedExtras.length +
              filteredMyCircles.filter((c) => !selectedIds.includes(c.id))
                .length;
            const selected = selectedIds.includes(item.id);
            const guestRoom =
              !guestQuota || guestQuota.remaining > guestSelected;
            const disabled =
              locked || (!selected && (guestAtMax || !guestRoom));
            return (
              <View>
                {index === otherStart ? (
                  <Text style={styles.sectionTitle}>Other circles</Text>
                ) : null}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled }}
                  style={[styles.row, disabled && styles.rowDisabled]}
                  onPress={() => toggle(item.id, "guest")}
                  disabled={disabled}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <AccessBadge mode="guest" />
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {circleTypeLabel(item.circleType)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowTitle,
                          disabled && styles.rowTitleDisabled,
                        ]}
                        numberOfLines={2}
                      >
                        {item.displayName}
                      </Text>
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      Guest · You can access only your post and replies
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
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
              </View>
            );
          }}
          ListFooterComponent={
            searching ? (
              <View style={styles.footerStatus}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : searchError ? (
              <Text style={styles.emptyText}>{searchError}</Text>
            ) : otherCircles.length === 0 && query.trim() ? (
              <Text style={styles.emptyText}>
                No eligible circles match your search.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            locked ? null : (
              <Text style={styles.emptyText}>
                Search to find other circles, or choose from My circles above.
              </Text>
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

export function PostTypeSheet({
  visible,
  onClose,
  value,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  value: PostTagValue;
  onChange: (tag: PostTagValue) => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <SheetHeader
          title="Post type"
          subtitle="Helps other parents know what to expect"
          onDone={onClose}
        />
        <FlatList
          data={[...POST_TAGS]}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = value === item.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.row, selected && styles.rowLocked]}
                onPress={() => {
                  onChange(item.value);
                  onClose();
                }}
              >
                <View
                  style={[styles.typeIconWrap, { backgroundColor: item.bg }]}
                >
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text
                  style={[styles.rowTitle, selected && { color: item.color }]}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={selected ? theme.primary : theme.tabInactive}
                />
              </Pressable>
            );
          }}
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
          title="Add interests"
          subtitle={`${selectedSlugs.length} of ${MAX_TOPICS} selected · helps parents discover this post`}
          onDone={close}
        />

        <View style={styles.searchWrap}>
          <SearchField
            placeholder="Search interests, e.g. tennis or screen time"
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
            <Text style={styles.emptyText}>
              No interests match your search.
            </Text>
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
    gap: 6,
  },
  counterText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  quotaText: {
    fontSize: 12,
    color: theme.primaryDark,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 6,
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
    flexWrap: "wrap",
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },
  rowTitleDisabled: { color: theme.tabInactive },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: theme.surfaceMuted,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textMuted,
  },
  accessBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accessBadgeMember: { backgroundColor: theme.primarySoft },
  accessBadgeGuest: { backgroundColor: "#FEF3C7" },
  accessBadgeText: { fontSize: 10, fontWeight: "800" },
  accessBadgeTextMember: { color: theme.primaryDark },
  accessBadgeTextGuest: { color: "#92400E" },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topicName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  emptyText: {
    textAlign: "center",
    color: theme.textMuted,
    fontSize: 14,
    paddingVertical: 24,
    lineHeight: 20,
  },
  footerStatus: { paddingVertical: 16, alignItems: "center" },
});
