import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { FEATURE_FLAGS } from "@/constants/features";
import { colors } from "@/constants/theme";

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
    bg: colors.primarySoft,
    border: colors.primaryLight,
    text: colors.primaryDark,
  },
  locality: {
    bg: colors.card,
    border: colors.border,
    text: colors.text,
  },
  school_class: {
    bg: "#ecfdf5",
    border: "#a7f3d0",
    text: colors.primaryDark,
  },
  class: {
    bg: colors.card,
    border: colors.border,
    text: colors.text,
  },
  school: {
    bg: "#fff7ed",
    border: colors.accentLight,
    text: "#9a3412",
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Your circles</Text>
      <Text style={styles.handle}>{user?.anonymousHandle}</Text>
      <Text style={styles.hint}>
        {circles.length > 0
          ? `You are in ${circles.length} circle${circles.length !== 1 ? "s" : ""} based on your children, school, and area.`
          : "Add your children and location to join parent circles."}
      </Text>

      {(FEATURE_FLAGS.showDoctors ||
        FEATURE_FLAGS.showPlaydates ||
        FEATURE_FLAGS.showCarpool) && (
        <View style={styles.discoveryRow}>
          {FEATURE_FLAGS.showDoctors ? (
            <Pressable
              style={styles.discoveryChip}
              onPress={() => router.push("/(app)/practitioners")}
            >
              <Text style={styles.discoveryChipText}>Doctors</Text>
            </Pressable>
          ) : null}
          {FEATURE_FLAGS.showPlaydates ? (
            <Pressable
              style={styles.discoveryChip}
              onPress={() => router.push("/(app)/playdates")}
            >
              <Text style={styles.discoveryChipText}>Playdates</Text>
            </Pressable>
          ) : null}
          {FEATURE_FLAGS.showCarpool ? (
            <Pressable
              style={styles.discoveryChip}
              onPress={() => router.push("/(app)/carpool")}
            >
              <Text style={styles.discoveryChipText}>Carpool</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.discoveryRow}>
        <Pressable
          style={styles.discoveryChip}
          onPress={() => router.push("/(app)/schools")}
        >
          <Text style={styles.discoveryChipText}>Schools</Text>
        </Pressable>
        <Pressable
          style={styles.discoveryChip}
          onPress={() => router.push("/(app)/topics")}
        >
          <Text style={styles.discoveryChipText}>Topics</Text>
        </Pressable>
        <Pressable
          style={styles.discoveryChip}
          onPress={() => router.push("/(app)/experts")}
        >
          <Text style={styles.discoveryChipText}>Experts</Text>
        </Pressable>
        <Pressable
          style={styles.discoveryChip}
          onPress={() => router.push("/(app)/calendar")}
        >
          <Text style={styles.discoveryChipText}>Calendar</Text>
        </Pressable>
      </View>

      {weekEvents.length > 0 ? (
        <View style={styles.weekStrip}>
          <Text style={styles.weekTitle}>This week at school</Text>
          {weekEvents.map((event) => (
            <Pressable
              key={event.id}
              style={styles.weekItem}
              onPress={() => router.push("/(app)/calendar")}
            >
              <Text style={styles.weekItemTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.weekItemMeta} numberOfLines={1}>
                {event.schoolName} · {new Date(event.startsAt).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!hasAnyContent ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No circles yet. Add your children and location under Profile to get
            started.
          </Text>
        </View>
      ) : (
        <>
          <CirclesCallout />
          <CircleSection
            title="Curriculum wise"
            circles={curriculum}
            onPressCircle={openCircle}
          />
          <CircleSection
            title="Pincode / Area"
            circles={locality}
            placeholders={areaPlaceholders}
            onPressCircle={openCircle}
          />
          <CircleSection
            title="My child's class at school"
            circles={schoolClassCircles}
            onPressCircle={openCircle}
          />
          <CircleSection
            title="Class circles"
            circles={classCircles}
            onPressCircle={openCircle}
          />
          <CircleSection
            title="School circles"
            circles={schoolCircles}
            placeholders={schoolPlaceholders}
            onPressCircle={openCircle}
          />
          <CircleSection
            title="Community circles"
            circles={community}
            placeholders={communityPlaceholders}
            onPressCircle={openCircle}
          />
        </>
      )}

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
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
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
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  weekItem: { paddingVertical: 6 },
  weekItemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  weekItemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  circleTagPressed: { opacity: 0.88 },
  circleTagMain: { flex: 1, minWidth: 0 },
  circleTagType: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  circleTagLabel: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  circleTagMeta: {
    fontSize: 12,
    fontWeight: "600",
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
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
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
