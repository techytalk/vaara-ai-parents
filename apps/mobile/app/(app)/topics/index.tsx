import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Chip, EmptyState, ScreenLoader, SectionHeader } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { api, type TopicCatalogItem } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function TopicsScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<
    Record<string, TopicCatalogItem[]>
  >({});
  const [followed, setFollowed] = useState<TopicCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [catalog, mine] = await Promise.all([
          api.getTopicsCatalog(token),
          api.getFollowedTopics(token),
        ]);
        setCategories(catalog.categories);
        setFollowed(mine);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  function openTopic(topic: TopicCatalogItem) {
    router.push({
      pathname: "/(app)/topics/[slug]",
      params: { slug: topic.slug, title: topic.name },
    });
  }

  if (loading) {
    return <ScreenLoader label="Loading topics" />;
  }

  const hasTopics =
    followed.length > 0 || Object.values(categories).some((list) => list.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!hasTopics ? (
        <EmptyState
          icon="pricetags-outline"
          title="No topics yet"
          message="Topics appear as parents tag posts in your circles. Follow topics to see related posts in one feed."
        />
      ) : null}

      {followed.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Following" />
          <View style={styles.chipRow}>
            {followed.map((topic) => (
              <Chip
                key={topic.slug}
                label={topic.name}
                selected
                onPress={() => openTopic(topic)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {Object.entries(categories).map(([category, topics]) => (
        <View key={category} style={styles.section}>
          <SectionHeader title={category} />
          <View style={styles.chipRow}>
            {topics.map((topic) => (
              <Chip
                key={topic.slug}
                label={topic.name}
                selected={followed.some((item) => item.slug === topic.slug)}
                onPress={() => openTopic(topic)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  section: { gap: spacing.xs },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
