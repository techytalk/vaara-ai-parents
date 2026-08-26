import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {followed.length > 0 ? (
        <>
          <Text style={styles.section}>Following</Text>
          <View style={styles.chipRow}>
            {followed.map((topic) => (
              <Pressable
                key={topic.slug}
                style={styles.chip}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/topics/[slug]",
                    params: { slug: topic.slug, title: topic.name },
                  })
                }
              >
                <Text style={styles.chipText}>{topic.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {Object.entries(categories).map(([category, topics]) => (
        <View key={category}>
          <Text style={styles.section}>{category}</Text>
          <View style={styles.chipRow}>
            {topics.map((topic) => (
              <Pressable
                key={topic.slug}
                style={styles.chipOutline}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/topics/[slug]",
                    params: { slug: topic.slug, title: topic.name },
                  })
                }
              >
                <Text style={styles.chipOutlineText}>{topic.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  chipOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipOutlineText: { color: colors.text, fontWeight: "600", fontSize: 13 },
});
