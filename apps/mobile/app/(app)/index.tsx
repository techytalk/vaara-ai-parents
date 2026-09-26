import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChatHomeScreen } from "@/components/chat/ChatHomeScreen";
import { Avatar, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useRealtimeChannels } from "@/hooks/useRealtimeChannels";
import { api } from "@/lib/api";
import { pickPrimaryCircle } from "@/lib/home-feed";
import { hasCompletedAppTour } from "@/lib/app-tour";
import {
  dismissCompletionPrompt,
  evaluateCompletionGaps,
  hrefForCompletionPrompt,
  pickActiveCompletionPrompt,
  type CompletionPromptCandidate,
} from "@/lib/completion-prompts";
import { trackEvent, trackHomeFirstOpen } from "@/lib/analytics";
import {
  endAuthenticatedSession,
  isUnauthorized,
} from "@/lib/authenticated-state";
import { prefetchAppScreens } from "@/hooks/useSessionQueries";
import { getToken, saveSession } from "@/lib/session";
import {
  clearOnboardingDraft,
  getOnboardingChildren,
  getOnboardingCircles,
  getOnboardingUser,
} from "@/lib/onboarding-draft";
import { CompletionPrompt } from "@/components/CompletionPrompt";
import { HomeTourOverlay, useHomeTour } from "@/components/tour/HomeTourOverlay";
import { LuckyGiftScratchCard } from "@/components/lucky-gift/ScratchCard";
import type { LuckyGiftResponse } from "@/lib/api";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [draftSnapshot] = useState(() => ({
    user: getOnboardingUser(),
    circles: getOnboardingCircles(),
    children: getOnboardingChildren(),
  }));
  const [activePrompt, setActivePrompt] =
    useState<CompletionPromptCandidate | null>(null);
  const [luckyGift, setLuckyGift] = useState<LuckyGiftResponse | null>(null);
  const [luckyGiftReady, setLuckyGiftReady] = useState(false);
  const [luckyGiftDismissed, setLuckyGiftDismissed] = useState(false);
  const [claimSheetOpen, setClaimSheetOpen] = useState(false);
  const authExitStartedRef = useRef(false);
  const homeFirstOpenFiredRef = useRef(false);
  const luckyGiftAttemptedRef = useRef(false);

  useEffect(() => {
    clearOnboardingDraft();
  }, []);

  const userQuery = useQuery({
    queryKey: ["sessionUser"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const me = await api.me(token);
      await saveSession(token, me);
      return me;
    },
    initialData: draftSnapshot.user ?? undefined,
    retry: false,
  });
  const user = userQuery.data ?? null;

  const circlesQuery = useQuery({
    queryKey: ["circles"],
    queryFn: () => authed((token) => api.getCircles(token)),
    initialData: draftSnapshot.circles ?? undefined,
    retry: false,
  });
  const circles = circlesQuery.data ?? [];

  const notificationsQuery = useQuery({
    queryKey: ["me", "notifications"],
    queryFn: () => authed((token) => api.getNotifications(token)),
    retry: false,
  });
  const unreadAlerts =
    notificationsQuery.data?.filter((item) => !item.readAt).length ?? 0;

  const childrenQuery = useQuery({
    queryKey: ["me", "children"],
    queryFn: () => authed((token) => api.getChildren(token)),
    initialData: draftSnapshot.children ?? undefined,
    retry: false,
  });

  const refreshHome = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["chatHome"] });
  }, [queryClient]);

  useEffect(() => {
    if (!userQuery.isSuccess) return;
    prefetchAppScreens();
  }, [userQuery.isSuccess]);

  useEffect(() => {
    const unauthorized = [
      userQuery.error,
      circlesQuery.error,
      notificationsQuery.error,
      childrenQuery.error,
    ].some(isUnauthorized);
    if (!unauthorized || authExitStartedRef.current) return;

    authExitStartedRef.current = true;
    void endAuthenticatedSession().finally(() => {
      router.replace("/(auth)/login");
    });
  }, [
    userQuery.error,
    circlesQuery.error,
    notificationsQuery.error,
    childrenQuery.error,
    router,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        !circlesQuery.isSuccess ||
        !childrenQuery.isSuccess
      ) {
        setActivePrompt(null);
        return;
      }
      if (!(await hasCompletedAppTour())) {
        if (!cancelled) setActivePrompt(null);
        return;
      }
      const gaps = evaluateCompletionGaps({
        children: childrenQuery.data ?? [],
        circles: circlesQuery.data ?? [],
      });
      const prompt = await pickActiveCompletionPrompt(gaps);
      if (!cancelled) setActivePrompt(prompt);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    childrenQuery.data,
    childrenQuery.isSuccess,
    circlesQuery.data,
    circlesQuery.isSuccess,
  ]);

  const circleChannels = useMemo(
    () => circles.map((circle) => `circle:${circle.id}`),
    [circles]
  );

  useRealtimeChannels({
    channels: circleChannels,
    enabled: circleChannels.length > 0,
    onEvent: (event) => {
      if (
        event.type === "chat.message" ||
        event.type === "inbox.updated" ||
        event.type === "post.new" ||
        event.type === "reply.new"
      ) {
        refreshHome();
      }
    },
    onPollFallback: refreshHome,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Home",
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={8}
          style={styles.bellBtn}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadAlerts > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadAlerts > 9 ? "9+" : unreadAlerts}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, router, unreadAlerts]);

  const primaryCircle = useMemo(() => pickPrimaryCircle(circles), [circles]);
  const loading = userQuery.isLoading;
  const composeLocked = circlesQuery.isPending || circlesQuery.isError;
  const showLuckyGift =
    !luckyGiftDismissed && luckyGift?.status === "pending";
  const needsClaimReminder =
    luckyGift?.status === "revealed" &&
    luckyGift.outcome === "win" &&
    !luckyGift.phoneSubmitted &&
    luckyGift.claimsOpen;
  const tour = useHomeTour(
    Boolean(user) && circlesQuery.isSuccess && luckyGiftReady,
    showLuckyGift
  );

  async function refreshLuckyGift() {
    try {
      const token = await getToken();
      if (!token) {
        setLuckyGift({ status: "hidden" });
        return;
      }
      const res = await api.getLuckyGift(token);
      setLuckyGift(res);
      if (res.status !== "pending") {
        setLuckyGiftDismissed(false);
      }
    } catch {
      // Keep prior state; reminder / card can retry next visit.
    }
  }

  useEffect(() => {
    if (!user || !circlesQuery.isSuccess || luckyGiftAttemptedRef.current) return;
    luckyGiftAttemptedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setLuckyGiftReady(true);
          return;
        }
        const res = await api.getLuckyGift(token);
        if (!cancelled) setLuckyGift(res);
      } catch {
        // Don't block the tour forever on API failure.
      } finally {
        if (!cancelled) setLuckyGiftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, circlesQuery.isSuccess]);

  useEffect(() => {
    if (homeFirstOpenFiredRef.current) return;
    if (!circlesQuery.isSuccess || !user) return;
    homeFirstOpenFiredRef.current = true;
    void trackHomeFirstOpen(user.id, {
      circle_count: circles.length,
      post_count: 0,
    });
  }, [
    circlesQuery.isSuccess,
    user,
    circles.length,
  ]);

  async function onDismissPrompt() {
    if (!activePrompt) return;
    const { count } = await dismissCompletionPrompt(activePrompt.key);
    trackEvent("completion_prompt_dismissed", {
      prompt: activePrompt.kind,
      dismissal_count: count,
    });
    setActivePrompt(null);
  }

  function onPressPrompt() {
    if (!activePrompt) return;
    const href = hrefForCompletionPrompt(activePrompt);
    router.push(href as never);
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.hero}>
        <Avatar
          handle={user?.anonymousHandle ?? "Parent"}
          avatarKey={user?.avatarKey}
          size={48}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>
            {greetingForHour(new Date().getHours())},
          </Text>
          <Text style={styles.heroHandle}>
            {user?.anonymousHandle ?? "Parent"} 👋
          </Text>
        </View>
      </View>

      {activePrompt ? (
        <CompletionPrompt
          prompt={activePrompt}
          onPress={onPressPrompt}
          onDismiss={onDismissPrompt}
        />
      ) : null}

      {needsClaimReminder && !tour.visible && !showLuckyGift ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Claim your gift voucher"
          onPress={() => setClaimSheetOpen(true)}
          style={styles.claimBanner}
        >
          <Ionicons name="gift-outline" size={20} color={colors.primary} />
          <View style={styles.claimBannerCopy}>
            <Text style={styles.claimBannerTitle}>
              Claim your {luckyGift.status === "revealed" ? luckyGift.prizeLabel : "₹500 gift voucher"}
            </Text>
            <Text style={styles.claimBannerLead}>
              Add your phone so we can send the voucher details.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a thread"
        disabled={composeLocked}
        onPress={() =>
          router.push({
            pathname: "/(app)/messages",
            params: { from: "home" },
          } as never)
        }
        style={[styles.composeCard, composeLocked && styles.composeLocked]}
      >
        <Avatar
          handle={user?.anonymousHandle ?? "Parent"}
          avatarKey={user?.avatarKey}
          size={36}
        />
        <Text style={styles.composePlaceholder}>Ask your group</Text>
      </Pressable>
    </View>
  );

  if (loading || isUnauthorized(userQuery.error)) {
    return <ScreenLoader label="Loading Home" />;
  }

  return (
    <View style={styles.screen}>
      {listHeader}
      <ChatHomeScreen />

      {primaryCircle && !tour.visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a thread"
          onPress={() =>
          router.push({
            pathname: "/(app)/messages",
            params: { from: "home" },
          } as never)
        }
          style={styles.fab}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Thread</Text>
        </Pressable>
      ) : null}

      <HomeTourOverlay
        visible={tour.visible}
        circles={circles}
        onFinished={tour.dismiss}
      />

      {showLuckyGift && luckyGift?.status === "pending" ? (
        <LuckyGiftScratchCard
          visible
          pending={luckyGift}
          onFinished={(next) => {
            setLuckyGiftDismissed(true);
            if (next) {
              setLuckyGift(next);
            } else {
              void refreshLuckyGift();
            }
          }}
        />
      ) : null}

      {claimSheetOpen &&
      luckyGift?.status === "revealed" &&
      luckyGift.outcome === "win" ? (
        <LuckyGiftScratchCard
          visible
          claim={luckyGift}
          onFinished={(next) => {
            setClaimSheetOpen(false);
            if (next) {
              setLuckyGift(next);
            } else {
              void refreshLuckyGift();
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + 72,
    flexGrow: 1,
  },
  footerLoader: { marginVertical: spacing.md },
  headerBlock: { marginBottom: spacing.md },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroCopy: { flex: 1 },
  greeting: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.medium,
  },
  heroHandle: {
    ...typography.sectionTitle,
    color: colors.text,
    fontFamily: typography.bold,
  },
  composeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  composePlaceholder: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    flex: 1,
  },
  composeActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  composeAction: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  composeActionText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  composeLocked: { opacity: 0.5 },
  claimBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  claimBannerCopy: { flex: 1 },
  claimBannerTitle: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: 2,
  },
  claimBannerLead: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
  },
  bellBtn: { marginRight: 8, position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    ...typography.supporting,
    color: "#fff",
    fontFamily: typography.bold,
  },
});
