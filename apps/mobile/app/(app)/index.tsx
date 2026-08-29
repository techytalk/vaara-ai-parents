import { useCallback, useLayoutEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  api,
  type AuthUser,
  type Child,
  type Circle,
  type TopicCatalogItem,
} from "@/lib/api";
import { getToken } from "@/lib/session";
import {
  CIRCLE_TYPE_LABELS,
  isPlaceholderSchool,
} from "@/constants/circles";
import { HomeInterestsPanel } from "@/components/HomeInterestsPanel";
import { Avatar, Card, ScreenLoader, SectionHeader } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/features";
import { colors, radii, spacing, typography } from "@/constants/theme";

type CirclePlaceholder = {
  key: string;
  message: string;
  cta: string;
  onPress: () => void;
};

const CIRCLE_TAG_COLORS: Record<
  Circle["circleType"],
  { bg: string; border: string; text: string }
> = {
  curriculum: {
    bg: "#F2EDFF",
    border: "#D8CBFF",
    text: "#6648B5",
  },
  locality: {
    bg: colors.card,
    border: colors.border,
    text: colors.text,
  },
  school_class: {
    bg: colors.primarySoft,
    border: colors.primaryLight,
    text: colors.primaryDark,
  },
  class: {
    bg: colors.card,
    border: colors.border,
    text: colors.text,
  },
  school: {
    bg: colors.accentLight,
    border: colors.accentLight,
    text: colors.accentDark,
  },
  community: {
    bg: colors.card,
    border: colors.border,
    text: colors.text,
  },
};

function CircleTag({
  circle,
  onPress,
}: {
  circle: Circle;
  onPress: () => void;
}) {
  const palette = CIRCLE_TAG_COLORS[circle.circleType];
  const parentLabel =
    circle.memberCount === 1 ? "1 parent" : `${circle.memberCount} parents`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.circleTag,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.circleTagPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${circle.displayName}, ${parentLabel}. Open circle feed.`}
    >
      <View style={styles.circleTagMain}>
        <Text style={styles.circleTagType}>
          {CIRCLE_TYPE_LABELS[circle.circleType]}
        </Text>
        <Text
          style={[styles.circleTagLabel, { color: palette.text }]}
          numberOfLines={2}
        >
          {circle.displayName}
        </Text>
        <Text style={[styles.circleTagMeta, { color: palette.text }]}>
          {parentLabel} · Tap to view posts
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={palette.text}
        style={styles.circleTagChevron}
      />
    </Pressable>
  );
}

function CirclesCallout() {
  return (
    <View style={styles.circlesCallout}>
      <View style={styles.circlesCalloutIcon}>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.circlesCalloutMain}>
        <Text style={styles.circlesCalloutTitle}>Tap a circle to open its feed</Text>
        <Text style={styles.circlesCalloutBody}>
          See what parents are posting, vote in polls, and reply — all anonymously.
        </Text>
      </View>
    </View>
  );
}

function PlaceholderTag({ placeholder }: { placeholder: CirclePlaceholder }) {
  return (
    <Pressable style={styles.placeholderTag} onPress={placeholder.onPress}>
      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
      <Text style={styles.placeholderTagText} numberOfLines={2}>
        {placeholder.cta}
      </Text>
    </Pressable>
  );
}

function CircleSection({
  title,
  circles,
  placeholders = [],
  onPressCircle,
}: {
  title: string;
  circles: Circle[];
  placeholders?: CirclePlaceholder[];
  onPressCircle: (circle: Circle) => void;
}) {
  if (circles.length === 0 && placeholders.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.tagCloud}>
        {circles.map((circle) => (
          <CircleTag
            key={circle.id}
            circle={circle}
            onPress={() => onPressCircle(circle)}
          />
        ))}
        {placeholders.map((placeholder) => (
          <PlaceholderTag key={placeholder.key} placeholder={placeholder} />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [weekEvents, setWeekEvents] = useState<
    Array<{ id: string; title: string; startsAt: string; schoolName?: string }>
  >([]);
  const [topicCategories, setTopicCategories] = useState<
    Record<string, TopicCatalogItem[]>
  >({});
  const [followedTopicSlugs, setFollowedTopicSlugs] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const [me, circleList, kids, notifications, upcomingEvents, topicsCatalog, followedTopics] =
        await Promise.all([
        api.me(token),
        api.getCircles(token),
        api.getChildren(token),
        api.getNotifications(token).catch(() => []),
        api.getUpcomingSchoolEvents(token).catch(() => []),
        api.getTopicsCatalog(token).catch(() => ({ categories: {} })),
        api.getFollowedTopics(token).catch(() => []),
      ]);
      if (!me.onboardingComplete) {
        router.replace("/onboarding/children");
        return;
      }
      setUser(me);
      setCircles(circleList);
      setChildren(kids);
      setUnreadAlerts(
        notifications.filter((item) => !item.readAt).length
      );
      setWeekEvents(upcomingEvents.slice(0, 3));
      setTopicCategories(topicsCatalog.categories);
      setFollowedTopicSlugs(new Set(followedTopics.map((t) => t.slug)));
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={8}
          style={styles.bellBtn}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadAlerts > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadAlerts > 9 ? "9+" : unreadAlerts}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, router, unreadAlerts]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  if (loading) {
    return <ScreenLoader label="Preparing your community" />;
  }

  const curriculum = circles.filter((c) => c.circleType === "curriculum");
  const locality = circles.filter((c) => c.circleType === "locality");
  const schoolClassCircles = circles.filter((c) => c.circleType === "school_class");
  const classCircles = circles.filter((c) => c.circleType === "class");
  const schoolCircles = circles.filter((c) => c.circleType === "school");
  const community = circles.filter((c) => c.circleType === "community");

  const childrenMissingSchool = children.filter((child) =>
    isPlaceholderSchool(child.school)
  );

  const areaPlaceholders: CirclePlaceholder[] =
    locality.length === 0
      ? [
          {
            key: "missing-area",
            message:
              "Add your pin code and area so we can connect you with nearby parents.",
            cta: "Update location details",
            onPress: () => router.push("/onboarding/location"),
          },
        ]
      : [];

  const schoolPlaceholders: CirclePlaceholder[] = childrenMissingSchool.map(
    (child) => ({
      key: `missing-school-${child.id}`,
      message: `Add ${child.nickname}'s school to join parents at the same school and discuss class topics.`,
      cta: `Update school for ${child.nickname}`,
      onPress: () =>
        router.push({
          pathname: "/onboarding/children/edit/[id]",
          params: { id: child.id },
        }),
    })
  );

  const communityPlaceholders: CirclePlaceholder[] =
    community.length === 0
      ? [
          {
            key: "missing-community",
            message:
              "Add your apartment or community name to connect with parents in your housing society.",
            cta: "Update community info",
            onPress: () => router.push("/onboarding/location"),
          },
        ]
      : [];

  const openCircle = (circle: Circle) =>
    router.push({
      pathname: "/circles/[circleId]",
      params: { circleId: circle.id, title: circle.displayName },
    });

  const openTopic = (topic: TopicCatalogItem) =>
    router.push({
      pathname: "/(app)/topics/[slug]",
      params: { slug: topic.slug, title: topic.name },
    });

  const hasAnyContent =
    circles.length > 0 ||
    areaPlaceholders.length > 0 ||
    schoolPlaceholders.length > 0 ||
    communityPlaceholders.length > 0;

  const circlePriority: Circle["circleType"][] = [
    "school_class",
    "class",
    "school",
    "community",
    "locality",
    "curriculum",
  ];
  const previewCircles = [...circles]
    .sort(
      (a, b) =>
        circlePriority.indexOf(a.circleType) -
        circlePriority.indexOf(b.circleType)
    )
    .slice(0, 4);
  const shortcuts = [
    {
      label: "Activities",
      icon: "compass-outline" as const,
      color: colors.amber,
      route: "/(app)/activities" as const,
    },
    {
      label: "Schools",
      icon: "school-outline" as const,
      color: colors.coral,
      route: "/(app)/schools" as const,
    },
    {
      label: "Topics",
      icon: "pricetags-outline" as const,
      color: colors.lavender,
      route: "/(app)/topics" as const,
    },
    {
      label: "Experts",
      icon: "shield-checkmark-outline" as const,
      color: colors.teal,
      route: "/(app)/experts" as const,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Avatar handle={user?.anonymousHandle ?? "Parent"} size={48} />
        <View style={styles.heroCopy}>
          <Text style={styles.welcome}>Good to see you,</Text>
          <Text style={styles.heroHandle}>
            {user?.anonymousHandle ?? "Parent"}
          </Text>
        </View>
        <View style={styles.privatePill}>
          <Ionicons name="lock-closed" size={12} color={colors.primaryDark} />
          <Text style={styles.privatePillText}>Private</Text>
        </View>
      </View>

      <SectionHeader
        title="My Circles"
        actionLabel="See all"
        onAction={() => router.push("/(app)/circles" as never)}
      />
      <Text style={styles.sectionLead}>
        Parents connected by your children's school, class and area.
      </Text>

      {previewCircles.length > 0 ? (
        <View style={styles.previewList}>
          {previewCircles.map((circle) => (
            <CircleTag
              key={circle.id}
              circle={circle}
              onPress={() => openCircle(circle)}
            />
          ))}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Your circles are being formed</Text>
          <Text style={styles.emptyText}>
            Add your child's school and your location to meet relevant parents.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/onboarding/children")}
          >
            <Text style={styles.emptyAction}>Complete your profile</Text>
          </Pressable>
        </Card>
      )}

      <Card style={styles.privacyCard}>
        <View style={styles.privacyIcon}>
          <Ionicons
            name="shield-checkmark"
            size={24}
            color={colors.primaryDark}
          />
        </View>
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>
            You are safe in every circle
          </Text>
          <Text style={styles.privacyBody}>
            Parents see your anonymous handle—not your real name or child details.
          </Text>
        </View>
      </Card>

      <SectionHeader title="Discover for your family" />
      <View style={styles.shortcutGrid}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            accessibilityLabel={`Open ${shortcut.label}`}
            onPress={() => router.push(shortcut.route)}
            style={({ pressed }) => [
              styles.shortcut,
              pressed && styles.circleTagPressed,
            ]}
          >
            <View
              style={[
                styles.shortcutIcon,
                { backgroundColor: `${shortcut.color}18` },
              ]}
            >
              <Ionicons
                name={shortcut.icon}
                size={22}
                color={shortcut.color}
              />
            </View>
            <Text style={styles.shortcutText}>{shortcut.label}</Text>
          </Pressable>
        ))}
      </View>

      {weekEvents.length > 0 ? (
        <View style={styles.calendarBlock}>
          <SectionHeader
            title="This week at school"
            actionLabel="Calendar"
            onAction={() => router.push("/(app)/calendar")}
          />
          <Card style={styles.weekStrip}>
            {weekEvents.map((event, index) => (
              <Pressable
                key={event.id}
                style={[
                  styles.weekItem,
                  index > 0 && styles.weekItemBorder,
                ]}
                onPress={() => router.push("/(app)/calendar")}
              >
                <View style={styles.dateIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.coral}
                  />
                </View>
                <View style={styles.weekCopy}>
                  <Text style={styles.weekItemTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.weekItemMeta} numberOfLines={1}>
                    {event.schoolName} ·{" "}
                    {new Date(event.startsAt).toLocaleDateString()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}

      <HomeInterestsPanel
        categories={topicCategories}
        followedSlugs={followedTopicSlugs}
        onToggleFollow={toggleTopicFollow}
        onOpenTopic={openTopic}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroCopy: { flex: 1 },
  welcome: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  heroHandle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  privatePill: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  privatePillText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
  },
  sectionLead: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  previewList: { gap: spacing.xs, marginBottom: spacing.md },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.text },
  handle: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 4,
    fontWeight: "600",
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 12,
  },
  circlesCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: 14,
    marginBottom: 16,
  },
  circlesCalloutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  circlesCalloutMain: { flex: 1 },
  circlesCalloutTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  circlesCalloutBody: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  discoveryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  discoveryChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  discoveryChipText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  weekStrip: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarBlock: { marginTop: spacing.md },
  weekTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  weekItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xs,
  },
  weekItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCopy: { flex: 1 },
  weekItemTitle: {
    ...typography.supporting,
    fontFamily: typography.semibold,
    color: colors.text,
  },
  weekItemMeta: {
    ...typography.caption,
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  circleTag: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
  },
  circleTagPressed: { opacity: 0.88 },
  circleTagMain: { flex: 1, minWidth: 0 },
  circleTagType: {
    fontSize: 10,
    fontFamily: typography.bold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  circleTagLabel: {
    ...typography.body,
    fontFamily: typography.semibold,
  },
  circleTagMeta: {
    ...typography.caption,
    fontFamily: typography.medium,
    marginTop: 4,
    opacity: 0.85,
  },
  circleTagChevron: { marginLeft: 4 },
  placeholderTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    backgroundColor: colors.primarySoft,
    maxWidth: "100%",
  },
  placeholderTagText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  emptyText: {
    ...typography.body,
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  emptyAction: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    marginTop: spacing.sm,
  },
  privacyCard: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  privacyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyCopy: { flex: 1 },
  privacyTitle: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
  },
  privacyBody: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 3,
  },
  shortcutGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  shortcut: {
    minHeight: 86,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  bellBtn: { marginRight: 8, position: "relative" },
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
});
