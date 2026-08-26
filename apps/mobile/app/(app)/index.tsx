import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  api,
  type AuthUser,
  type Child,
  type Circle,
} from "@/lib/api";
import { getToken } from "@/lib/session";
import {
  CIRCLE_TYPE_LABELS,
  isPlaceholderSchool,
} from "@/constants/circles";
import { colors } from "@/constants/theme";

type CirclePlaceholder = {
  key: string;
  message: string;
  cta: string;
  onPress: () => void;
};

function CircleCard({
  circle,
  onPress,
}: {
  circle: Circle;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.circleCard} onPress={onPress}>
      <View style={styles.circleMain}>
        <Text style={styles.circleName} numberOfLines={2}>
          {circle.displayName}
        </Text>
        <Text style={styles.circleMeta}>
          {circle.memberCount} parent{circle.memberCount !== 1 ? "s" : ""}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {CIRCLE_TYPE_LABELS[circle.circleType]}
        </Text>
      </View>
    </Pressable>
  );
}

function PlaceholderCard({ placeholder }: { placeholder: CirclePlaceholder }) {
  return (
    <Pressable style={styles.placeholderCard} onPress={placeholder.onPress}>
      <View style={styles.placeholderIcon}>
        <Text style={styles.placeholderMark}>?</Text>
      </View>
      <View style={styles.placeholderMain}>
        <Text style={styles.placeholderMessage}>{placeholder.message}</Text>
        <Text style={styles.placeholderCta}>{placeholder.cta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
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
      {circles.map((circle) => (
        <CircleCard
          key={circle.id}
          circle={circle}
          onPress={() => onPressCircle(circle)}
        />
      ))}
      {placeholders.map((placeholder) => (
        <PlaceholderCard key={placeholder.key} placeholder={placeholder} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const [me, circleList, kids] = await Promise.all([
        api.me(token),
        api.getCircles(token),
        api.getChildren(token),
      ]);
      if (!me.onboardingComplete) {
        router.replace("/onboarding/children");
        return;
      }
      setUser(me);
      setCircles(circleList);
      setChildren(kids);
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
        Connect with parents by curriculum, area, class, school, and community.
        Tap a circle to see posts and message parents anonymously.
      </Text>

      {!hasAnyContent ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No circles yet. Add your children and location under Profile to get
            started.
          </Text>
        </View>
      ) : (
        <>
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
    marginBottom: 16,
  },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  circleCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  circleMain: { flex: 1, minWidth: 0 },
  circleName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
  circleMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, color: colors.primaryDark, fontWeight: "600" },
  placeholderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  placeholderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderMark: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },
  placeholderMain: { flex: 1 },
  placeholderMessage: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  placeholderCta: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
});
