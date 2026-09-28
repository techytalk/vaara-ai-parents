import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, InlineError } from "@/components/ui";
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Circle } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function AskCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    circleId,
    circleName,
    circleType,
    subtitle,
  } = useLocalSearchParams<{
    circleId: string;
    circleName?: string;
    circleType?: string;
    subtitle?: string;
  }>();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel =
    CIRCLE_TYPE_LABELS[(circleType ?? "") as Circle["circleType"]] ??
    (circleType ? circleType.replace(/_/g, " ") : "Circle");

  async function onSend() {
    const body = text.trim();
    if (!body || sending || !circleId) return;
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const thread = await api.createGuestThread(token, circleId, {
        title: body.slice(0, 140),
        body,
        kind: "question",
      });
      router.replace({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: String(thread.id) },
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not send question";
      setError(message);
      Alert.alert("Could not send", message);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Ask as guest</Text>
        <View style={styles.backPad} />
      </View>

      <View style={styles.body}>
        <View style={styles.target}>
          <Text style={styles.targetName}>{circleName || "Circle"}</Text>
          <Text style={styles.targetMeta}>
            Guest · {typeLabel}
            {subtitle ? ` · ${subtitle}` : ""}
          </Text>
          <Text style={styles.hint}>
            Parents in this circle will see your question and can reply here.
            You only get this thread — not the rest of the group.
          </Text>
        </View>

        {error ? <InlineError message={error} /> : null}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write your question…"
          placeholderTextColor={colors.textSubtle}
          multiline
          textAlignVertical="top"
          style={styles.input}
          maxLength={4000}
          editable={!sending}
        />

        <Button
          label="Send question"
          onPress={() => void onSend()}
          loading={sending}
          disabled={!text.trim() || sending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  back: { width: 40, alignItems: "flex-start" },
  backPad: { width: 40 },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.text,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  target: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  targetName: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
  },
  targetMeta: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  hint: {
    marginTop: spacing.xs,
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  input: {
    minHeight: 160,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.text,
  },
});
