import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeInterestsPanel } from "@/components/HomeInterestsPanel";
import {
  Avatar,
  Card,
  EmptyState,
  InlineError,
  ScreenLoader,
  SectionHeader,
} from "@/components/ui";
import { CIRCLE_TYPE_LABELS, isPlaceholderSchool } from "@/constants/circles";
import { getDiscoveryShortcuts } from "@/constants/discovery-shortcuts";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import { useRealtimeChannels } from "@/hooks/useRealtimeChannels";
import {
  api,
  type AuthUser,
  type Child,
  type Circle,
  type SchoolEvent,
  type TopicCatalogItem,
} from "@/lib/api";
import { circleCardSubtitle, circleCardTitle } from "@/lib/circle-display";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { getToken } from "@/lib/session";

type ScreenTab = "circles" | "topics";

type CirclePlaceholder = {
  key: string;
  cta: string;
  onPress: () => void;
};

const circlePriority: Circle["circleType"][] = [
  "school_class",
  "class",
  "school",
  "community",
  "locality",
  "curriculum",
];

const circleIconColors: Record<Circle["circleType"], string> = {
  school_class: colors.lavender,
  class: colors.coral,
  school: colors.amber,
  community: colors.teal,
  locality: colors.primaryDark,
  curriculum: colors.lavender,
};

const DISCOVERY_SHORTCUTS = getDiscoveryShortcuts();

function iconForType(type: Circle["circleType"]) {
  const icons: Record<Circle["circleType"], keyof typeof Ionicons.glyphMap> = {
    curriculum: "library-outline",
    locality: "location-outline",
    community: "home-outline",
    school: "school-outline",
    class: "people-outline",
    school_class: "shield-checkmark-outline",
  };
  return icons[type];
}

function formatEventWhen(startsAt: string) {
  const date = new Date(startsAt);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CircleListCard({
  circle,
  onPress,
}: {
  circle: Circle;
  onPress: () => void;
}) {
  const iconColor = circleIconColors[circle.circleType];
  const memberLabel =
    circle.memberCount === 1
      ? "1 parent"
      : `${circle.memberCount} parents`;
  const newCount = circle.newPostCount ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${circle.displayName}, ${memberLabel}${
        newCount > 0 ? `, ${newCount} new posts` : ""
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.circleCard, pressed && styles.pressed]}
    >
      <View style={[styles.circleIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons
          name={iconForType(circle.circleType)}
          size={22}
          color={iconColor}
        />
      </View>
      <View style={styles.circleCopy}>
        <Text style={styles.circleName} numberOfLines={2}>
          {circleCardTitle(circle)}
        </Text>
        <Text style={styles.circleSubtitle} numberOfLines={1}>
          {circleCardSubtitle(circle)}
        </Text>
        <Text style={styles.circleMeta} numberOfLines={1}>
          {CIRCLE_TYPE_LABELS[circle.circleType]} · {memberLabel}
        </Text>
      </View>
      {newCount > 0 ? (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>
            {newCount > 99 ? "99+" : newCount} new
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      )}
    </Pressable>
  );
}

export default function CirclesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ScreenTab>("circles");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<SchoolEvent[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [topicCategories, setTopicCategories] = useState<
    Record<string, TopicCatalogItem[]>
  >({});
  const [followedTopicSlugs, setFollowedTopicSlugs] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const [
        me,
        circleList,
        kids,
        topicsCatalog,
        followedTopics,
        notifications,
        events,
      ] = await Promise.all([
        api.me(token),
        api.getCircles(token),
        api.getChildren(token),
        api.getTopicsCatalog(token).catch(() => ({ categories: {} })),
        api.getFollowedTopics(token).catch(() => []),
        api.getNotifications(token).catch(() => []),
        api.getUpcomingSchoolEvents(token).catch(() => []),
      ]);
      if (!me.onboardingComplete) {
        router.replace("/onboarding/children");
        return;
      }
      setUser(me);
      setCircles(circleList);
      setChildren(kids);
      setTopicCategories(topicsCatalog.categories);
      setFollowedTopicSlugs(new Set(followedTopics.map((topic) => topic.slug)));
      setUnreadAlerts(notifications.filter((item) => !item.readAt).length);
      setUpcomingEvents(events.slice(0, 3));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load circles"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const circleChannels = useMemo(
    () => circles.map((circle) => `circle:${circle.id}`),
    [circles]
  );

  useRealtimeChannels({
    channels: circleChannels,
    enabled: circleChannels.length > 0,
    onEvent: (event) => {
      if (event.type === "post.new") {
        load();
      }
    },
    onPollFallback: load,
  });

  const toggleTopicFollow = useCallback(
    async (slug: string, shouldFollow: boolean) => {
      const token = await getToken();
      if (!token) return;
      if (shouldFollow) {
        await api.followTopic(token, slug);
        setFollowedTopicSlugs((prev) => new Set(prev).add(slug));
      } else {
        await api.unfollowTopic(token, slug);
        setFollowedTopicSlugs((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }
    },
    []
  );

  const groupedCircles = useMemo(() => {
    const sorted = [...circles].sort(
      (a, b) =>
        circlePriority.indexOf(a.circleType) -
        circlePriority.indexOf(b.circleType)
    );
    const groups: Array<{ type: Circle["circleType"]; items: Circle[] }> = [];
    for (const type of circlePriority) {
      const items = sorted.filter((circle) => circle.circleType === type);
      if (items.length > 0) {
        groups.push({ type, items });
      }
    }
    return groups;
  }, [circles]);

  const primaryCircle = useMemo(() => pickPrimaryCircle(circles), [circles]);

  const childrenMissingSchool = children.filter((child) =>
    isPlaceholderSchool(child.school)
  );

  const placeholders: CirclePlaceholder[] = [];
  if (circles.filter((c) => c.circleType === "locality").length === 0) {
    placeholders.push({
      key: "missing-area",
      cta: "Add your pin code and area",
      onPress: () => router.push("/onboarding/location"),
    });
  }
  for (const child of childrenMissingSchool) {
    placeholders.push({
      key: `missing-school-${child.id}`,
      cta: `Add school for ${child.nickname}`,
      onPress: () =>
        router.push({
          pathname: "/onboarding/children/edit/[id]",
          params: { id: child.id },
        }),
    });
  }
  if (circles.filter((c) => c.circleType === "community").length === 0) {
    placeholders.push({
      key: "missing-community",
      cta: "Add your apartment or community",
      onPress: () => router.push("/onboarding/location"),
    });
  }

  const openCircle = (circle: Circle) => {
    setCircles((current) =>
      current.map((item) =>
        item.id === circle.id ? { ...item, newPostCount: 0 } : item
      )
    );
    router.push({
      pathname: "/circles/[circleId]",
      params: { circleId: circle.id, title: circle.displayName },
    });
  };

  const openTopic = (topic: TopicCatalogItem) =>
    router.push({
      pathname: "/(app)/topics/[slug]",
      params: { slug: topic.slug, title: topic.name },
    });

  function openNewPost() {
    if (!primaryCircle) {
      router.push("/onboarding/children");
      return;
    }
    router.push({
      pathname: "/circles/[circleId]/new-post",
      params: {
        circleId: primaryCircle.id,
        title: primaryCircle.displayName,
      },
    });
  }

  if (loading) return <ScreenLoader label="Finding your circles" />;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxxl + 72 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.topBar}>
          <View style={styles.hero}>
            <Avatar handle={user?.anonymousHandle ?? "Parent"} size={44} />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Your parent network</Text>
              <Text style={styles.title}>My Circles</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={8}
            style={styles.bellBtn}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.text}
            />
            {unreadAlerts > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {(["circles", "topics"] as ScreenTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabChip, active && styles.tabChipActive]}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                  {tab === "circles" ? "Circles" : "Topics"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "circles" ? (
          <>
            <Text style={styles.intro}>
              Open a circle for posts from parents in your school, class and
              locality.
            </Text>

            {error ? <InlineError message={error} onRetry={load} /> : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutRow}
            >
              {DISCOVERY_SHORTCUTS.map((shortcut) => (
                <Pressable
                  key={shortcut.key}
                  style={styles.shortcut}
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
                      styles.shortcutIcon,
                      { backgroundColor: `${shortcut.color}18` },
                    ]}
                  >
                    <Ionicons
                      name={shortcut.icon}
                      size={20}
                      color={shortcut.color}
                    />
                  </View>
                  <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {upcomingEvents.length > 0 ? (
              <View style={styles.calendarBlock}>
                <View style={styles.calendarHeader}>
                  <SectionHeader title="Upcoming events" />
                  <Pressable
                    onPress={() => router.push("/(app)/calendar")}
                    hitSlop={8}
                  >
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.eventList}>
                  {upcomingEvents.map((event, index) => (
                    <View key={event.id}>
                      {index > 0 ? (
                        <View style={styles.eventDivider} />
                      ) : null}
                      <Pressable
                        style={({ pressed }) => [
                          styles.eventCard,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => router.push("/(app)/calendar")}
                      >
                        <View style={styles.eventIcon}>
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={colors.coral}
                          />
                        </View>
                        <View style={styles.eventCopy}>
                          <Text style={styles.eventTitle} numberOfLines={1}>
                            {event.title}
                          </Text>
                          <Text style={styles.eventMeta} numberOfLines={1}>
                            {event.schoolName ? `${event.schoolName} · ` : ""}
                            {formatEventWhen(event.startsAt)}
                          </Text>
                        </View>
                        {event.unconfirmed ? (
                          <Text style={styles.eventUnconfirmed}>
                            Unconfirmed
                          </Text>
                        ) : null}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {groupedCircles.length > 0 ? (
              <>
                {groupedCircles.map((group) => (
                  <View key={group.type} style={styles.groupBlock}>
                    <SectionHeader title={CIRCLE_TYPE_LABELS[group.type]} />
                    <View style={styles.list}>
                      {group.items.map((circle, index) => (
                        <View key={circle.id}>
                          {index > 0 ? (
                            <View style={styles.circleDivider} />
                          ) : null}
                          <CircleListCard
                            circle={circle}
                            onPress={() => openCircle(circle)}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                <Card style={styles.banner}>
                  <View style={styles.bannerCopy}>
                    <Text style={styles.bannerTitle}>
                      You are in {circles.length} circle
                      {circles.length === 1 ? "" : "s"}
                    </Text>
                    <Text style={styles.bannerBody}>
                      Connect with parents in your school, class and community.
                    </Text>
                  </View>
                  <Ionicons
                    name="people-circle-outline"
                    size={42}
                    color={colors.primaryDark}
                  />
                </Card>
              </>
            ) : (
              <EmptyState
                icon="people-outline"
                title="Your circles are being formed"
                message="Add your child's school, curriculum, grade and your location to find the right parent communities."
                actionLabel="Complete profile"
                onAction={() => router.push("/onboarding/children")}
              />
            )}

            {placeholders.length > 0 ? (
              <View style={styles.placeholderBlock}>
                <SectionHeader title="Complete your profile" />
                <View style={styles.placeholderList}>
                  {placeholders.map((placeholder) => (
                    <Pressable
                      key={placeholder.key}
                      style={styles.placeholderChip}
                      onPress={placeholder.onPress}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.placeholderText}>
                        {placeholder.cta}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <HomeInterestsPanel
            categories={topicCategories}
            followedSlugs={followedTopicSlugs}
            onToggleFollow={toggleTopicFollow}
            onOpenTopic={openTopic}
          />
        )}
      </ScrollView>

      {activeTab === "circles" && primaryCircle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create post"
          onPress={openNewPost}
          style={[styles.fab, { bottom: spacing.lg }]}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Post</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  heroCopy: { flex: 1 },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginTop: 2,
  },
  bellBtn: { marginTop: 4, position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tabChip: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tabChipText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
  },
  tabChipTextActive: {
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginBottom: spacing.md,
  },
  shortcutRow: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingRight: spacing.sm,
  },
  shortcut: {
    width: 78,
    alignItems: "center",
    gap: 6,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  calendarBlock: { marginBottom: spacing.lg },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: typography.bold,
    marginBottom: spacing.sm,
  },
  eventList: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  eventDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.sm * 2 + 34,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${colors.coral}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitle: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  eventMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  eventUnconfirmed: {
    ...typography.caption,
    color: colors.amber,
    fontFamily: typography.bold,
  },
  groupBlock: { marginBottom: spacing.md },
  list: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  circleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.sm * 2 + 46,
  },
  circleCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  circleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  circleCopy: { flex: 1, minWidth: 0 },
  circleName: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  circleSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    marginTop: 1,
  },
  circleMeta: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.medium,
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: colors.coral,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  newBadgeText: {
    ...typography.caption,
    color: "#fff",
    fontFamily: typography.bold,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  bannerCopy: { flex: 1 },
  bannerTitle: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
  },
  bannerBody: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  placeholderBlock: { marginBottom: spacing.md },
  placeholderList: { gap: spacing.xs },
  placeholderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    backgroundColor: colors.primarySoft,
  },
  placeholderText: {
    ...typography.supporting,
    color: colors.primary,
    fontFamily: typography.semibold,
    flexShrink: 1,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    ...typography.supporting,
    color: "#fff",
    fontFamily: typography.bold,
  },
});
