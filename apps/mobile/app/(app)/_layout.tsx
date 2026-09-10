import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Device from "expo-device";
import { Ionicons } from "@expo/vector-icons";
import { colors, tabBarStyleForInsets, typography } from "@/constants/theme";
import { useBottomChromeInset } from "@/hooks/useBottomChromeInset";
import { setupPushNotifications } from "@/lib/push";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: TabIconName, inactive: TabIconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function AppLayout() {
  const router = useRouter();
  const bottomInset = useBottomChromeInset();

  useEffect(() => {
    const stopPushRegistration = setupPushNotifications();

    if (!Device.isDevice) {
      return () => {
        stopPushRegistration();
      };
    }

    let cancelled = false;
    let subscription: { remove?: () => void } | undefined;

    function openNotification(data: Record<string, unknown>) {
      const type = String(data.type ?? "");
      if (type === "connection_request") {
        router.push("/(app)/messages/new");
        return;
      }
      if (
        data.conversationId &&
        (type === "direct_message" ||
          type === "disclosure_request" ||
          type === "disclosure_accepted")
      ) {
        router.push({
          pathname: "/(app)/messages/[conversationId]",
          params: { conversationId: String(data.conversationId) },
        });
        return;
      }
      if (type === "circle_reply" && data.circleId && data.postId) {
        router.push({
          pathname: "/circles/[circleId]/posts/[postId]",
          params: {
            circleId: String(data.circleId),
            postId: String(data.postId),
          },
        });
      }
    }

    void import("expo-notifications")
      .then((Notifications) => {
        if (cancelled) return;
        try {
          subscription = Notifications.addNotificationResponseReceivedListener(
            (response) => {
              openNotification(response.notification.request.content.data);
            }
          );
          return Notifications.getLastNotificationResponseAsync().then(
            (response) => {
              if (response) {
                openNotification(response.notification.request.content.data);
              }
            }
          );
        } catch {
          // Incomplete native binaries can throw NativeEventEmitter errors.
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      stopPushRegistration();
      subscription?.remove?.();
    };
  }, [router]);

  return (
    <Tabs
      initialRouteName="index"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: typography.bold, color: colors.text },
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: tabBarStyleForInsets(bottomInset),
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: typography.semibold,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 1 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarLabel: "Feed",
          tabBarIcon: tabIcon("home", "home-outline"),
          href: "/",
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "Circles",
          tabBarLabel: "Circles",
          headerShown: false,
          tabBarIcon: tabIcon("people-circle", "people-circle-outline"),
          href: "/circles",
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarLabel: "Messages",
          headerShown: false,
          tabBarIcon: tabIcon("chatbubbles", "chatbubbles-outline"),
          href: "/messages",
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Discover",
          tabBarLabel: "Discover",
          tabBarIcon: tabIcon("compass", "compass-outline"),
          headerShown: false,
          href: "/activities",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarIcon: tabIcon("grid", "grid-outline"),
          href: "/profile",
        }}
      />
      <Tabs.Screen
        name="schools"
        options={{
          href: null,
          title: "Schools",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Alerts",
        }}
      />
      <Tabs.Screen name="market" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="reminders"
        options={{ href: null, title: "Reminders" }}
      />
      <Tabs.Screen
        name="saved"
        options={{ href: null, title: "Saved posts" }}
      />
      <Tabs.Screen
        name="your-posts"
        options={{ href: null, title: "Your posts" }}
      />
      <Tabs.Screen
        name="contact-details"
        options={{ href: null, title: "Contact details" }}
      />
      <Tabs.Screen name="topics" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="calendar" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="practitioners" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="experts" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="playdates" options={{ href: null, title: "Playdates" }} />
      <Tabs.Screen name="carpool" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="support" options={{ href: null, title: "Help & Support" }} />
    </Tabs>
  );
}
