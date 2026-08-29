import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthorRow,
  cardShadow,
  formatPostTime,
  PollCard,
  PostMediaGallery,
  PostTagBadge,
  theme,
} from "@/components/circles/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { CirclePost } from "@/lib/api";

export function FeedPostCard({
  post,
  circleName,
  saved,
  onPress,
  onComment,
  onToggleSave,
  onToggleHelpful,
  onShare,
  onPollVote,
}: {
  post: CirclePost;
  circleName?: string;
  saved?: boolean;
  onPress: () => void;
  onComment?: () => void;
  onToggleSave?: () => void;
  onToggleHelpful?: () => void;
  onShare?: () => void;
  onPollVote?: (optionId: string) => void;
}) {
  const helpfulCount = post.helpfulCount ?? 0;
  const engagementParts: string[] = [];
  if (helpfulCount > 0) {
    engagementParts.push(
      `${helpfulCount} parent${helpfulCount === 1 ? "" : "s"} found this helpful`
    );
  }
  if (post.poll?.totalVotes) {
    engagementParts.push(
      `${post.poll.totalVotes} vote${post.poll.totalVotes === 1 ? "" : "s"}`
    );
  }
  if (post.replyCount > 0) {
    engagementParts.push(
      `${post.replyCount} comment${post.replyCount === 1 ? "" : "s"}`
    );
  }

  return (
    <Pressable
      style={[styles.card, cardShadow()]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {circleName ? (
        <Pressable
          style={styles.circleBadge}
          onPress={onPress}
          hitSlop={4}
        >
          <Ionicons name="people-outline" size={12} color={colors.primaryDark} />
          <Text style={styles.circleBadgeText} numberOfLines={1}>
            {circleName}
          </Text>
        </Pressable>
      ) : null}
      <AuthorRow
        handle={post.author.anonymousHandle}
        contextLabel={post.author.contextLabel}
        timestamp={post.createdAt}
      />
      <View style={styles.body}>
        <PostTagBadge tag={post.tag} />
        {post.body ? <Text style={styles.text}>{post.body}</Text> : null}
      </View>
      {post.poll && onPollVote ? (
        <PollCard poll={post.poll} compact onVote={onPollVote} />
      ) : null}
      <PostMediaGallery media={post.media ?? []} />
      {engagementParts.length > 0 ? (
        <Text style={styles.engagement}>{engagementParts.join(" · ")}</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={onToggleHelpful}
          hitSlop={8}
          disabled={!onToggleHelpful}
        >
          <Ionicons
            name={post.myHelpful ? "thumbs-up" : "thumbs-up-outline"}
            size={18}
            color={post.myHelpful ? colors.primary : theme.textMuted}
          />
          <Text
            style={[
              styles.actionText,
              post.myHelpful && styles.actionTextActive,
            ]}
          >
            Helpful
          </Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onComment ?? onPress} hitSlop={8}>
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={theme.textMuted}
          />
          <Text style={styles.actionText}>
            {post.replyCount > 0 ? `Comment (${post.replyCount})` : "Comment"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={onShare}
          hitSlop={8}
          disabled={!onShare}
        >
          <Ionicons name="share-outline" size={18} color={theme.textMuted} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
        {onToggleSave ? (
          <Pressable style={styles.action} onPress={onToggleSave} hitSlop={8}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={18}
              color={saved ? theme.primary : theme.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.time}>{formatPostTime(post.createdAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circleBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
    maxWidth: "100%",
  },
  circleBadgeText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    flexShrink: 1,
  },
  body: { marginTop: spacing.sm, gap: spacing.xs },
  text: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
    fontFamily: typography.regular,
  },
  engagement: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
  },
  actionText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.semibold,
  },
  actionTextActive: { color: colors.primary },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
  },
});
