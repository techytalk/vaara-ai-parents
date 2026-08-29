import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { VaaraLogo } from "@/components/VaaraLogo";
import { Button, Card } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { completeIntro } from "@/lib/intro";
import { trackEvent } from "@/lib/analytics";

type IntroScene = {
  key: string;
  eyebrow?: string;
  title: string;
  accent: string;
  description: string;
  image?: ImageSourcePropType;
};

const scenes: IntroScene[] = [
  {
    key: "welcome",
    title: "Connect with parents from the same school, same class and same locality.",
    accent: "same school, same class and same locality.",
    description:
      "Plus discover verified tutors, trusted schools, activities and everything your child needs to grow.",
    image: require("../../assets/illustrations/family-welcome.png"),
  },
  {
    key: "circles",
    eyebrow: "Your trusted parent network",
    title: "Connect with parents from the same school, class and locality",
    accent: "same school, class and locality",
    description:
      "Automatically join circles with parents in your child's school, class, curriculum and locality.",
    image: require("../../assets/illustrations/school-community.png"),
  },
  {
    key: "tutors",
    eyebrow: "Local and accountable",
    title: "Discover verified tutors and trainers in your locality",
    accent: "verified tutors and trainers in your locality",
    description:
      "Connect with reviewed teachers, trainers and institutions serving your area.",
    image: require("../../assets/illustrations/verified-tutor.png"),
  },
  {
    key: "curriculum",
    eyebrow: "Decisions with context",
    title:
      "Connect with IB, IGCSE and Cambridge parents and make better decisions",
    accent: "IB, IGCSE and Cambridge parents",
    description:
      "Explore curriculum-specific advice, parent experiences and local recommendations from families on the same board.",
    image: require("../../assets/illustrations/curriculum-parents.png"),
  },
  {
    key: "community",
    eyebrow: "One safe parent community",
    title: "Everything your child needs, in one safe community",
    accent: "one safe community",
    description:
      "Discussions, recommendations, activities, marketplace, polls and much more.",
  },
];

const communityItems = [
  { icon: "chatbubbles", label: "Discussions", color: colors.lavender },
  { icon: "compass", label: "Activities", color: colors.amber },
  { icon: "bag-handle", label: "Marketplace", color: colors.coral },
  { icon: "stats-chart", label: "Polls", color: colors.teal },
  { icon: "calendar", label: "Events", color: "#5B8DEF" },
  { icon: "shield-checkmark", label: "Experts", color: colors.navy },
] as const;

function HighlightedTitle({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  const start = title.indexOf(accent);
  if (start < 0) return <Text style={styles.title}>{title}</Text>;
  return (
    <Text style={styles.title}>
      {title.slice(0, start)}
      <Text style={styles.titleAccent}>{accent}</Text>
      {title.slice(start + accent.length)}
    </Text>
  );
}

export default function IntroScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<IntroScene>>(null);
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const compact = height < 720;

  useEffect(() => {
    trackEvent("intro_started");
  }, []);

  function goTo(index: number) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setPage(index);
  }

  async function finish(destination: "/(auth)/login" | "/(auth)/register") {
    trackEvent("intro_completed", {
      destination: destination.includes("login") ? "login" : "register",
    });
    await completeIntro();
    router.replace(destination);
  }

  function skipIntro() {
    trackEvent("intro_skipped");
    void completeIntro().then(() => router.replace("/(auth)/register"));
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<IntroScene>[] }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setPage(index);
    }
  ).current;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        data={scenes}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width }]}>
            <View style={styles.topRow}>
              <VaaraLogo compact={index !== 0} />
              {index > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Skip introduction"
                  hitSlop={10}
                  onPress={skipIntro}
                >
                  <Text style={styles.skip}>Skip</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.copy, compact && styles.copyCompact]}>
              {item.eyebrow ? (
                <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              ) : null}
              <HighlightedTitle title={item.title} accent={item.accent} />
              <Text style={styles.description}>{item.description}</Text>
            </View>

            <View style={[styles.artwork, compact && styles.artworkCompact]}>
              {item.image ? (
                <Image
                  source={item.image}
                  style={styles.image}
                  resizeMode="contain"
                  accessible
                  accessibilityLabel={`${item.key} illustration`}
                />
              ) : (
                <View style={styles.featureGrid}>
                  {communityItems.map((feature) => (
                    <Card key={feature.label} style={styles.featureCard}>
                      <View
                        style={[
                          styles.featureIcon,
                          { backgroundColor: `${feature.color}1F` },
                        ]}
                      >
                        <Ionicons
                          name={feature.icon}
                          size={22}
                          color={feature.color}
                        />
                      </View>
                      <Text style={styles.featureLabel}>{feature.label}</Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.bottom}>
              {index === 0 ? (
                <>
                  <Button
                    label="Get Started"
                    onPress={() => goTo(1)}
                    style={styles.fullButton}
                  />
                  <Button
                    label="Log In"
                    variant="secondary"
                    onPress={() => finish("/(auth)/login")}
                    style={styles.fullButton}
                  />
                  <View style={styles.privacy}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={styles.privacyText}>Privacy first. Always.</Text>
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={styles.dots}
                    accessibilityLabel={`Page ${index} of ${scenes.length - 1}`}
                  >
                    {scenes.slice(1).map((scene, dotIndex) => (
                      <View
                        key={scene.key}
                        style={[
                          styles.dot,
                          dotIndex + 1 === index && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                  <Button
                    label={index === scenes.length - 1 ? "Let's Go" : "Next"}
                    icon={
                      index === scenes.length - 1
                        ? "sparkles-outline"
                        : "arrow-forward"
                    }
                    onPress={() =>
                      index === scenes.length - 1
                        ? finish("/(auth)/register")
                        : goTo(index + 1)
                    }
                    style={styles.fullButton}
                  />
                </>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  topRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skip: {
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    fontSize: 13,
  },
  copy: { paddingTop: spacing.lg },
  copyCompact: { paddingTop: spacing.xs },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.navy,
    fontFamily: typography.bold,
    letterSpacing: -1,
  },
  titleAccent: { color: colors.primaryDark },
  description: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.sm,
    maxWidth: 520,
  },
  artwork: {
    flex: 1,
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkCompact: { minHeight: 150 },
  image: { width: "100%", height: "100%", maxHeight: 330 },
  featureGrid: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  featureCard: {
    width: "29%",
    alignItems: "center",
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radii.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
    textAlign: "center",
  },
  bottom: { gap: spacing.xs },
  fullButton: { width: "100%" },
  privacy: {
    minHeight: 28,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  dots: {
    minHeight: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { width: 18, backgroundColor: colors.primary },
});
