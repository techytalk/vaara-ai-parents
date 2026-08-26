import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { avatarPalette, colors } from "@/constants/theme";

export const theme = colors;

export const AVATAR_COLORS = avatarPalette;

export const POST_TAGS = [
  {
    value: "question",
    label: "Question",
    icon: "help-circle-outline" as const,
    color: "#0369a1",
    bg: "#e0f2fe",
  },
  {
    value: "recommendation",
    label: "Recommendation",
    icon: "star-outline" as const,
    color: "#047857",
    bg: "#d1fae5",
  },
  {
    value: "heads_up",
    label: "Heads up",
    icon: "megaphone-outline" as const,
    color: "#c2410c",
    bg: "#ffedd5",
  },
  {
    value: "general",
    label: "General",
    icon: "chatbubble-outline" as const,
    color: "#57534e",
    bg: "#f5f5f4",
  },
] as const;

export type PostTagValue = (typeof POST_TAGS)[number]["value"];

export function getTagMeta(tag: string) {
  return POST_TAGS.find((t) => t.value === tag) ?? POST_TAGS[3];
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarColorForHandle(handle: string): string {
  return AVATAR_COLORS[hashString(handle) % AVATAR_COLORS.length];
}

export function initialsFromHandle(handle: string): string {
  const parts = handle.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return handle.slice(0, 2).toUpperCase();
}

export function formatPostTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function cardShadow(style?: ViewStyle): ViewStyle {
  return {
    ...style,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  };
}

export function AuthorAvatar({
  handle,
  size = 40,
}: {
  handle: string;
  size?: number;
}) {
  const color = avatarColorForHandle(handle);
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>
        {initialsFromHandle(handle)}
      </Text>
    </View>
  );
}

export function PostTagBadge({ tag, compact }: { tag: string; compact?: boolean }) {
  const meta = getTagMeta(tag);
  return (
    <View
      style={[
        styles.tagBadge,
        compact && styles.tagBadgeCompact,
        { backgroundColor: meta.bg },
      ]}
    >
      <Ionicons
        name={meta.icon}
        size={compact ? 12 : 13}
        color={meta.color}
        style={styles.tagIcon}
      />
      <Text style={[styles.tagText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export function PostMediaGallery({
  media,
}: {
  media: Array<{
    id: string;
    type: "image" | "video";
    url: string;
  }>;
}) {
  if (media.length === 0) return null;

  return (
    <View style={styles.mediaGallery}>
      {media.map((item) => (
        <Pressable
          key={item.id}
          style={[
            styles.mediaItem,
            media.length === 1 && styles.mediaItemSingle,
          ]}
          onPress={() => Linking.openURL(item.url)}
        >
          {item.type === "image" ? (
            <Image source={{ uri: item.url }} style={styles.mediaImage} />
          ) : (
            <View style={styles.mediaVideo}>
              <View style={styles.mediaPlay}>
                <Ionicons name="play" size={22} color="#fff" />
              </View>
              <Text style={styles.mediaVideoText}>Play video</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function AuthorRow({
  handle,
  contextLabel,
  timestamp,
  size = "md",
}: {
  handle: string;
  contextLabel?: string;
  timestamp?: string;
  size?: "sm" | "md";
}) {
  const avatarSize = size === "sm" ? 32 : 40;
  return (
    <View style={styles.authorRow}>
      <AuthorAvatar handle={handle} size={avatarSize} />
      <View style={styles.authorMeta}>
        <Text style={[styles.authorHandle, size === "sm" && styles.authorHandleSm]}>
          {handle}
        </Text>
        {contextLabel ? (
          <Text style={styles.authorContext}>{contextLabel}</Text>
        ) : null}
      </View>
      {timestamp ? (
        <Text style={styles.timestamp}>{formatPostTime(timestamp)}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={32} color={theme.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color="#fff" style={styles.btnIcon} />
          ) : null}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ScreenLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  tagBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagIcon: { marginRight: 2 },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  mediaGallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  mediaItem: {
    width: "48.5%",
    aspectRatio: 1.2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.text,
  },
  mediaItemSingle: {
    width: "100%",
    aspectRatio: 1.6,
  },
  mediaImage: { width: "100%", height: "100%" },
  mediaVideo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.textMuted,
  },
  mediaPlay: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaVideoText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorMeta: { flex: 1 },
  authorHandle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },
  authorHandleSm: {
    fontSize: 14,
  },
  authorContext: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: theme.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  emptyAction: {
    marginTop: 20,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  btnIcon: { marginRight: 6 },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },
});
