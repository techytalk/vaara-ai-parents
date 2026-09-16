import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function ProviderChannelScreen() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: ["providerChannel", providerId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return api.getProviderChannel(token, String(providerId));
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  async function followAndMessage() {
    const token = await getToken();
    if (!token) return;
    await api.followProviderChannel(token, String(providerId));
    const conversation = await api.startConversation(token, {
      peerUserId: String(providerId),
      myRole: "parent",
      peerRole: "provider",
    });
    router.push({
      pathname: "/(app)/messages/[conversationId]",
      params: { conversationId: conversation.id },
    });
  }

  if (query.isLoading) return <ScreenLoader label="Loading channel" />;
  const channel = query.data;
  if (!channel) {
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>Channel not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>{channel.name}</Text>
      <Text style={styles.badge}>Tutor</Text>
      <Pressable style={styles.cta} onPress={() => void followAndMessage()}>
        <Text style={styles.ctaLabel}>Message tutor</Text>
      </Pressable>
      {channel.updates.map((update) => (
        <View key={update.id} style={styles.card}>
          <Text style={styles.cardTitle}>{update.title}</Text>
          {update.preview ? (
            <Text style={styles.preview}>{update.preview}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: {
    fontFamily: typography.bold,
    fontSize: 24,
    color: colors.text,
  },
  badge: {
    marginTop: 6,
    fontFamily: typography.medium,
    color: colors.primaryDark,
  },
  empty: { color: colors.textMuted },
  cta: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  ctaLabel: { fontFamily: typography.semibold, color: colors.textInverse },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontFamily: typography.semibold, color: colors.text },
  preview: { marginTop: 4, color: colors.textMuted },
});
