import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Chip,
  EmptyState,
  InlineError,
  ScreenLoader,
  SearchField,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import { getCoordinationShortcuts } from "@/constants/discovery-shortcuts";
import { api, type Activity, type ActivityCategory } from "@/lib/api";
import { getToken } from "@/lib/session";

type FilterKey = "all" | "tutors" | "coaching" | "classes" | "arts";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tutors", label: "Tutors" },
  { key: "coaching", label: "Coaching" },
  { key: "classes", label: "Classes" },
  { key: "arts", label: "Arts" },
];

function apiFilterFor(filter: FilterKey): {
  providerType?: "teacher" | "trainer" | "institution";
  category?: ActivityCategory;
} {
  if (filter === "tutors") return { providerType: "teacher" };
  if (filter === "coaching") return { providerType: "trainer" };
  if (filter === "classes") return { category: "classes" };
  if (filter === "arts") return { category: "arts" };
  return {};
}

function providerLabel(activity: Activity) {
  const type = activity.provider?.providerType;
  if (type === "teacher") return "Tutor";
  if (type === "trainer") return "Coach";
  if (type === "institution") return "Class";
  return "Provider";
}

function gradeLabel(activity: Activity) {
  if (activity.minGradeId || activity.maxGradeId) {
    const min = activity.minGradeId ?? "?";
    const max = activity.maxGradeId ?? "?";
    return `Grades ${min}–${max}`;
  }
  return activity.locationText ?? "Near you";
}

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (searchOverride?: string) => {
    const currentRequest = ++requestId.current;
    setError(null);
    const token = await getToken();
    if (!token) return;
    const list = await api.discoverActivities(token, {
      q: (searchOverride ?? debouncedSearch).trim() || undefined,
      ...apiFilterFor(filter),
      verifiedOnly: false,
      sort: "rating",
    });
    if (currentRequest === requestId.current) {
      setActivities(list);
    }
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load()
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [load]);

  const featuredTutors = useMemo(() => {
    const seen = new Set<string>();
    const tutors: Activity[] = [];
    for (const activity of activities) {
      if (activity.provider?.providerType !== "teacher") continue;
      const key = activity.providerId ?? activity.provider?.orgName;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      tutors.push(activity);
      if (tutors.length >= 6) break;
    }
    return tutors.sort(
      (a, b) =>
        (b.provider?.ratingAvg ?? 0) - (a.provider?.ratingAvg ?? 0)
    );
  }, [activities]);

  const popularActivities = useMemo(
    () =>
      [...activities]
        .filter((item) => item.provider?.providerType !== "teacher")
        .sort(
          (a, b) =>
            (b.provider?.ratingAvg ?? 0) - (a.provider?.ratingAvg ?? 0)
        ),
    [activities]
  );

  function openActivity(id: string) {
    router.push({
      pathname: "/(app)/activities/[id]",
      params: { id },
    });
  }

  const coordinationShortcuts = getCoordinationShortcuts();

  if (loading) {
    return <ScreenLoader label="Finding tutors and activities" />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
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
        <View style={styles.headerRow}>
          <Text style={styles.headline}>
            Find tutors &{"\n"}activities near you
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={8}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.text}
            />
          </Pressable>
        </View>

        <SearchField
          placeholder="Search tutors, activities, classes…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => {
            const query = search.trim();
            setDebouncedSearch(query);
            load(query);
          }}
          returnKeyType="search"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          ))}
        </ScrollView>

        {error ? <InlineError message={error} onRetry={load} /> : null}

        {coordinationShortcuts.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Family & local care" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.coordinationRow}
            >
              {coordinationShortcuts.map((shortcut) => (
                <Pressable
                  key={shortcut.key}
                  style={styles.coordinationCard}
                  accessibilityRole="button"
                  accessibilityLabel={shortcut.label}
                  onPress={() => {
                    trackEvent("home_shortcut_opened", {
                      shortcut: shortcut.key,
                    });
                    router.push(shortcut.route as never);
                  }}
                >
                  <View
                    style={[
                      styles.coordinationIcon,
                      { backgroundColor: `${shortcut.color}18` },
                    ]}
                  >
                    <Ionicons
                      name={shortcut.icon}
                      size={22}
                      color={shortcut.color}
                    />
                  </View>
                  <Text style={styles.coordinationLabel}>{shortcut.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {filter === "all" ? (
          <View style={styles.section}>
            <SectionHeader
              title="Featured tutors"
              actionLabel="See all"
              onAction={() => setFilter("tutors")}
            />
            {featuredTutors.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                No verified tutors in your area yet.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tutorRow}
              >
                {featuredTutors.map((activity) => (
                  <Pressable
                    key={activity.id}
                    style={styles.tutorCard}
                    onPress={() => openActivity(activity.id)}
                  >
                    <Avatar
                      handle={activity.provider?.orgName ?? "Tutor"}
                      size={56}
                    />
                    <Text style={styles.tutorName} numberOfLines={1}>
                      {activity.provider?.orgName}
                    </Text>
                    <Text style={styles.tutorRole} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    {activity.provider?.ratingAvg != null ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={colors.amber} />
                        <Text style={styles.ratingText}>
                          {activity.provider.ratingAvg.toFixed(1)} (
                          {activity.provider.ratingCount ?? 0})
                        </Text>
                      </View>
                    ) : null}
                    {activity.provider?.verified ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons
                          name="shield-checkmark"
                          size={10}
                          color={colors.primaryDark}
                        />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title={
              filter === "all"
                ? "Popular activities"
                : FILTERS.find((item) => item.key === filter)?.label ??
                  "Results"
            }
          />
          {(() => {
            const listItems =
              filter === "all"
                ? popularActivities
                : activities;
            if (listItems.length === 0) {
              return (
                <EmptyState
                  icon="compass-outline"
                  title={
                    search.trim()
                      ? "No matching results"
                      : "Nothing nearby yet"
                  }
                  message={
                    search.trim()
                      ? "Try a different search or filter."
                      : "Providers in your pin code will appear here as they join Vaara."
                  }
                />
              );
            }
            return (
              <View style={styles.activityList}>
                {listItems.map((activity) => (
                  <Pressable
                    key={activity.id}
                    style={styles.activityRow}
                    onPress={() => openActivity(activity.id)}
                  >
                    {activity.imageUrl ? (
                      <Image
                        source={{ uri: activity.imageUrl }}
                        style={styles.activityThumb}
                      />
                    ) : (
                      <View style={styles.activityThumbPlaceholder}>
                        <Ionicons
                          name="fitness-outline"
                          size={22}
                          color={colors.primaryDark}
                        />
                      </View>
                    )}
                    <View style={styles.activityCopy}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <Text style={styles.activityMeta} numberOfLines={1}>
                        {providerLabel(activity)} · {gradeLabel(activity)}
                      </Text>
                      {activity.locationText ? (
                        <Text style={styles.activityLocation} numberOfLines={1}>
                          {activity.locationText}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.viewBtn}
                      onPress={() => openActivity(activity.id)}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            );
          })()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headline: {
    ...typography.screenTitle,
    color: colors.navy,
    fontFamily: typography.bold,
    flex: 1,
  },
  filterRow: { gap: spacing.xs, paddingVertical: 2 },
  section: { gap: spacing.sm },
  coordinationRow: { gap: spacing.sm, paddingRight: spacing.lg },
  coordinationCard: {
    width: 112,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.xs,
  },
  coordinationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  coordinationLabel: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  sectionEmpty: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  tutorRow: { gap: spacing.sm, paddingRight: spacing.lg },
  tutorCard: {
    width: 148,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
  },
  tutorName: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  tutorRole: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    fontSize: 10,
  },
  activityList: { gap: spacing.xs },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
  },
  activityThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  activityMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  activityLocation: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  viewBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  viewBtnText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
});
