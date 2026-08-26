import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import type { TopicCatalogItem } from "@/lib/api";

type Props = {
  categories: Record<string, TopicCatalogItem[]>;
  followedSlugs: Set<string>;
  onToggleFollow: (slug: string, shouldFollow: boolean) => Promise<void>;
  onOpenTopic: (topic: TopicCatalogItem) => void;
};

function TopicRow({
  topic,
  followed,
  toggling,
  onToggleFollow,
  onOpenTopic,
}: {
  topic: TopicCatalogItem;
  followed: boolean;
  toggling: boolean;
  onToggleFollow: (slug: string, shouldFollow: boolean) => Promise<void>;
  onOpenTopic: (topic: TopicCatalogItem) => void;
}) {
  return (
    <View style={styles.topicRow}>
      <Pressable
        style={styles.topicMain}
        onPress={() => onOpenTopic(topic)}
      >
        <View style={styles.topicTitleRow}>
          <Text style={styles.topicName}>{topic.name}</Text>
          {topic.sensitive ? (
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          ) : null}
        </View>
        {topic.description ? (
          <Text style={styles.topicDescription} numberOfLines={2}>
            {topic.description}
          </Text>
        ) : null}
        {topic.postCount != null && topic.postCount > 0 ? (
          <Text style={styles.topicMeta}>
            {topic.postCount} post{topic.postCount !== 1 ? "s" : ""} in your
            circles
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        style={[
          styles.followBtn,
          followed ? styles.followBtnActive : styles.followBtnIdle,
          toggling && styles.followBtnDisabled,
        ]}
        disabled={toggling}
        onPress={() => onToggleFollow(topic.slug, !followed)}
        hitSlop={6}
      >
        {toggling ? (
          <ActivityIndicator size="small" color={followed ? "#fff" : colors.primary} />
        ) : (
          <Ionicons
            name={followed ? "checkmark" : "add"}
            size={18}
            color={followed ? "#fff" : colors.primary}
          />
        )}
      </Pressable>
    </View>
  );
}

export function HomeInterestsPanel({
  categories,
  followedSlugs,
  onToggleFollow,
  onOpenTopic,
}: Props) {
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (slug: string, shouldFollow: boolean) => {
      setTogglingSlug(slug);
      try {
        await onToggleFollow(slug, shouldFollow);
      } finally {
        setTogglingSlug(null);
      }
    },
    [onToggleFollow]
  );

  const categoryEntries = Object.entries(categories);
  if (categoryEntries.length === 0) return null;

  const followedTopics = categoryEntries
    .flatMap(([, topics]) => topics)
    .filter((topic) => followedSlugs.has(topic.slug));

  return (
    <View style={styles.panel}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Interest topics</Text>
        <View style={styles.dividerLine} />
      </View>

      <Text style={styles.panelTitle}>What you care about</Text>
      <Text style={styles.panelHint}>
        Circles are who you know by school and area. Topics are what you want
        to read about — screen time, fees, sleep, and more.
      </Text>

      {followedTopics.length > 0 ? (
        <View style={styles.followedBlock}>
          <Text style={styles.blockLabel}>Following</Text>
          <View style={styles.followedCloud}>
            {followedTopics.map((topic) => (
              <View key={topic.slug} style={styles.followedChip}>
                <Pressable onPress={() => onOpenTopic(topic)}>
                  <Text style={styles.followedChipText}>{topic.name}</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => handleToggle(topic.slug, false)}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.blockLabel}>Explore & follow</Text>
      {categoryEntries.map(([category, topics]) => (
        <View key={category} style={styles.categoryBlock}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.categoryCard}>
            {topics.map((topic, index) => (
              <View key={topic.slug}>
                {index > 0 ? <View style={styles.topicDivider} /> : null}
                <TopicRow
                  topic={topic}
                  followed={followedSlugs.has(topic.slug)}
                  toggling={togglingSlug === topic.slug}
                  onToggleFollow={handleToggle}
                  onOpenTopic={onOpenTopic}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  panelHint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  followedBlock: { marginBottom: 16 },
  blockLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  followedCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  followedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 999,
  },
  followedChipText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  categoryBlock: { marginBottom: 14 },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 6,
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 12,
    gap: 8,
  },
  topicMain: { flex: 1, minWidth: 0 },
  topicTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topicName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  topicDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 3,
  },
  topicMeta: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    fontWeight: "600",
  },
  followBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  followBtnActive: {
    backgroundColor: colors.primary,
  },
  followBtnIdle: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  followBtnDisabled: { opacity: 0.6 },
  topicDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 14,
  },
});
