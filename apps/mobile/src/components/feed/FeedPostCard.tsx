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
  discovery,
  saved,
  onPress,
  onComment,
  onToggleSave,
  onToggleHelpful,
  onShare,
  onPollVote,
  onReport,
}: {
  post: CirclePost;
  circleName?: string;
  discovery?: boolean;
  saved?: boolean;
  onPress: () => void;
  onComment?: () => void;
  onToggleSave?: () => void;
  onToggleHelpful?: () => void;
  onShare?: () => void;
  onPollVote?: (optionId: string) => void;
  onReport?: () => void;
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
      {discovery ? (
        <View style={styles.discoveryBadge}>
          <Ionicons name="compass-outline" size={12} color={colors.textMuted} />
          <Text style={styles.discoveryBadgeText}>
            Suggested from another circle
          </Text>
        </View>
      ) : null}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderMain}>
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
        </View>
        {onReport ? (
          <Pressable
            style={styles.reportBtn}
            onPress={() => onReport()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report post"
          >
            <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <AuthorRow
        handle={post.author.anonymousHandle}
        avatarKey={post.author.avatarKey}
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
          style={styles.helpfulAction}
          onPress={onToggleHelpful}
          hitSlop={8}
          disabled={!onToggleHelpful}
          accessibilityRole="button"
          accessibilityLabel="Mark as helpful"
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
        <View style={styles.iconActions}>
          <Pressable
            style={styles.iconAction}
            onPress={onComment ?? onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              post.replyCount > 0
                ? `Comment, ${post.replyCount} replies`
                : "Comment"
            }
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={theme.textMuted}
            />
          </Pressable>
          <Pressable
            style={styles.iconAction}
            onPress={onShare}
            hitSlop={8}
            disabled={!onShare}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <Ionicons name="share-outline" size={20} color={theme.textMuted} />
          </Pressable>
          {onToggleSave ? (
            <Pressable
              style={styles.iconAction}
              onPress={onToggleSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={saved ? "Unsave post" : "Save post"}
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={20}
                color={saved ? theme.primary : theme.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
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
  discoveryBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.xs,
  },
  discoveryBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  cardHeaderMain: {
    flex: 1,
  },
  reportBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
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
  helpfulAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingRight: spacing.sm,
  },
  iconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  iconAction: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
