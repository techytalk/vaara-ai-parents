import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { pathTheme } from "@/constants/path-theme";
import { api, type PathwayItemDetail } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function PathwayDetailScreen() {
  const router = useRouter();
  const { slug, title } = useLocalSearchParams<{
    slug: string;
    title?: string;
  }>();
  const [detail, setDetail] = useState<PathwayItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const data = await api.getPathwayItem(token, slug);
        setDetail(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Not found");
      } finally {
        setLoading(false);
      }
    });
  }, [slug]);

  if (loading) {
    return <ScreenLoader label="Loading details" />;
  }

  if (error || !detail) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="document-outline"
          title="Not found"
          message={error ?? "This pathway item is unavailable."}
        />
      </View>
    );
  }

  const { item, related } = detail;

  return (
    <>
      <Stack.Screen options={{ title: title || item.title }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.lead}>{item.lead}</Text>

        <View style={styles.rows}>
          {item.detailRows.map((row) => (
            <View key={`${row.label}-${row.value}`} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {item.officialUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open official site"
            onPress={() => Linking.openURL(item.officialUrl!)}
            style={({ pressed }) => [
              styles.linkRow,
              pressed && styles.linkRowPressed,
            ]}
          >
            <Ionicons name="open-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>Official site</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSubtle}
            />
          </Pressable>
        ) : null}

        {related.length > 0 ? (
          <View style={styles.related}>
            <Text style={styles.relatedTitle}>Related</Text>
            {related.map((link) => (
              <Pressable
                key={`${link.rel}-${link.slug}`}
                accessibilityRole="button"
                accessibilityLabel={link.title}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/pathways/[slug]",
                    params: { slug: link.slug, title: link.title },
                  } as never)
                }
                style={({ pressed }) => [
                  styles.relatedRow,
                  pressed && styles.linkRowPressed,
                ]}
              >
                <View style={styles.relatedBody}>
                  <Text style={styles.relatedItemTitle}>{link.title}</Text>
                  <Text style={styles.relatedSummary}>{link.summary}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSubtle}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: pathTheme.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: pathTheme.title,
    fontFamily: typography.bold,
  },
  lead: {
    ...typography.body,
    color: pathTheme.deck,
    fontFamily: typography.medium,
  },
  rows: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 48,
    alignItems: "flex-start",
  },
  rowLabel: {
    width: 108,
    ...typography.supporting,
    color: colors.textSubtle,
    fontFamily: typography.semibold,
    paddingTop: 2,
  },
  rowValue: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    fontFamily: typography.medium,
  },
  linkRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  linkRowPressed: { backgroundColor: colors.surfaceMuted },
  linkText: {
    flex: 1,
    ...typography.body,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
  related: { gap: spacing.xs },
  relatedTitle: {
    ...typography.caption,
    color: colors.textSubtle,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  relatedRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  relatedBody: { flex: 1, gap: 2 },
  relatedItemTitle: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  relatedSummary: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
});
