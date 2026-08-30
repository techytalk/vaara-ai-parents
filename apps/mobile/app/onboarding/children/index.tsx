import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type Child } from "@/lib/api";
import { getToken } from "@/lib/session";
import { GENDER_LABEL } from "@/constants/onboarding";
import { formatChildDob } from "@/lib/dates";
import { colors, PrimaryButton, SecondaryButton } from "@/components/onboarding/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { radii, shadows, spacing, typography } from "@/constants/theme";

const unlockItems = [
  {
    icon: "school-outline" as const,
    label: "School & class circles",
    color: colors.teal,
  },
  {
    icon: "library-outline" as const,
    label: "Curriculum circles (IB, CBSE, IGCSE…)",
    color: colors.lavender,
  },
  {
    icon: "location-outline" as const,
    label: "Locality circles after step 2",
    color: colors.coral,
  },
];

function ChildCard({
  child,
  onPress,
}: {
  child: Child;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${child.nickname || "child"} profile`}
      onPress={onPress}
      style={({ pressed }) => [styles.childCard, pressed && styles.pressed]}
    >
      <View style={styles.childAvatar}>
        <Text style={styles.childAvatarText}>
          {(child.nickname?.trim()?.[0] ?? "C").toUpperCase()}
        </Text>
      </View>
      <View style={styles.childBody}>
        <Text style={styles.childName}>{child.nickname?.trim() || "Child"}</Text>
        <Text style={styles.childMeta}>
          {child.curriculum.name} · {child.grade.label}
        </Text>
        <Text style={styles.childSub} numberOfLines={1}>
          {GENDER_LABEL[child.gender] ?? child.gender}
          {child.dateOfBirth ? ` · Born ${formatChildDob(child.dateOfBirth)}` : ""}
          {child.school ? ` · ${child.school.displayLabel}` : ""}
        </Text>
      </View>
      <Ionicons name="create-outline" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function ChildrenListScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    const token = await getToken();
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const kids = await api.getChildren(token);
      setChildren(kids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load children");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
  }

  function onContinue() {
    if (children.length === 0) {
      setError("Add at least one child to continue");
      return;
    }
    router.push("/onboarding/location");
  }

  function openAddChild() {
    router.push("/onboarding/children/add");
  }

  if (loading && children.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Loading your family profile</Text>
      </View>
    );
  }

  const hasChildren = children.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "50%" }]} />
        </View>
        <Text style={styles.step}>Step 1 of 2</Text>
        <Text style={styles.title}>Tell us about your children</Text>
        <Text style={styles.lead}>
          Add each child's curriculum, grade and school. Vaara uses this to place
          you in the right parent circles — from nursery through 12th.
        </Text>

        <View style={styles.unlockCard}>
          <Text style={styles.unlockTitle}>What this unlocks</Text>
          {unlockItems.map((item) => (
            <View key={item.label} style={styles.unlockRow}>
              <View
                style={[
                  styles.unlockIcon,
                  { backgroundColor: `${item.color}18` },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.unlockLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Ionicons
            name="shield-checkmark"
            size={22}
            color={colors.primaryDark}
          />
          <Text style={styles.privacyText}>
            Your child's name never appears in circles. Only curriculum and
            grade context show alongside your anonymous handle.
          </Text>
        </View>

        {hasChildren ? (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>
              {children.length} child{children.length === 1 ? "" : "ren"} added
            </Text>
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onPress={() =>
                  router.push({
                    pathname: "/onboarding/children/[id]",
                    params: { id: child.id },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your first child"
            onPress={openAddChild}
            style={({ pressed }) => [
              styles.emptyCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.emptyIcon}>
              <Ionicons name="person-add-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Add your first child</Text>
            <Text style={styles.emptyBody}>
              Include curriculum and grade so we can match you with the right
              parent circles.
            </Text>
            <View style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>Tap to get started</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
            </View>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {hasChildren ? (
          <>
            <SecondaryButton
              label="+ Add another child"
              onPress={openAddChild}
            />
            <PrimaryButton
              label="Continue"
              onPress={onContinue}
              style={styles.primaryAction}
            />
          </>
        ) : (
          <PrimaryButton
            label="Add your first child"
            onPress={openAddChild}
            style={styles.primaryAction}
          />
        )}

        <SignOutButton />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  loaderText: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  step: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.text,
    fontFamily: typography.bold,
    letterSpacing: -0.8,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  unlockCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  unlockTitle: {
    ...typography.supporting,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: 2,
  },
  unlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  unlockIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockLabel: {
    ...typography.supporting,
    flex: 1,
    color: colors.text,
    fontFamily: typography.medium,
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  privacyText: {
    ...typography.supporting,
    flex: 1,
    color: colors.primaryDark,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  listSection: { gap: spacing.xs },
  listTitle: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.semibold,
    marginBottom: spacing.xs,
  },
  childCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...shadows.card,
  },
  pressed: { opacity: 0.78 },
  childAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  childAvatarText: {
    ...typography.sectionTitle,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  childBody: { flex: 1 },
  childName: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  childMeta: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    marginTop: 2,
  },
  childSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 3,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
    textAlign: "center",
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.md,
  },
  emptyCtaText: {
    ...typography.supporting,
    color: colors.primaryDark,
    fontFamily: typography.bold,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  primaryAction: { marginTop: spacing.xs },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.errorSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.supporting,
    flex: 1,
    color: colors.error,
    fontFamily: typography.medium,
  },
});
