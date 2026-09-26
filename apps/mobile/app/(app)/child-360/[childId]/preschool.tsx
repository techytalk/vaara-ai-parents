import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type Child360Hub } from "@/lib/api";
import { getToken } from "@/lib/session";

export default function PreschoolSummaryScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [data, setData] = useState<Child360Hub["child"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Preschool" });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const token = await getToken();
          if (!token) {
            router.replace("/(auth)/login");
            return;
          }
          const hub = await api.getChild360(token, childId);
          if (!cancelled) setData(hub.child);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [childId, router])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Not found"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{data.nickname?.trim() || "Child"}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Age circle</Text>
        <Text style={styles.value}>
          {data.ageYears ? `${data.ageYears} years` : "—"}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Campus</Text>
        <Text style={styles.value}>{data.school.displayLabel}</Text>
      </View>
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/onboarding/children/edit/[id]",
            params: { id: childId },
          })
        }
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.btnText}>Edit campus or age</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  name: {
    fontFamily: typography.bold,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  value: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  btnText: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: colors.primaryDark,
  },
  error: { color: colors.error, fontFamily: typography.regular },
});
