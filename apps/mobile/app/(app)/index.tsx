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
import { getToken, saveSession } from "@/lib/session";
import {
  clearOnboardingDraft,
  getOnboardingChildren,
  getOnboardingCircles,
  getOnboardingUser,
} from "@/lib/onboarding-draft";
import { CompletionPrompt } from "@/components/CompletionPrompt";
import { HomeTourOverlay, useHomeTour } from "@/components/tour/HomeTourOverlay";

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
  const authExitStartedRef = useRef(false);
  const homeFirstOpenFiredRef = useRef(false);

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
  const tour = useHomeTour(
    Boolean(user) && circlesQuery.isSuccess
  );

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a thread"
        disabled={composeLocked}
        onPress={() => router.push("/(app)/messages")}
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
          onPress={() => router.push("/(app)/messages")}
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
