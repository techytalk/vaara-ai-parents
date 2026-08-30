import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "@/constants/theme";
import { setupPushNotifications } from "@/lib/push";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: TabIconName, inactive: TabIconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    const stopPushRegistration = setupPushNotifications();

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
      }
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        openNotification(response.notification.request.content.data);
      });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotification(response.notification.request.content.data);
        }
      })
      .catch(() => {});

    return () => {
      stopPushRegistration();
      subscription.remove();
    };
  }, [router]);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: typography.bold, color: colors.text },
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 10,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: typography.semibold,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarLabel: "Feed",
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "Circles",
          tabBarLabel: "Circles",
          headerShown: false,
          tabBarIcon: tabIcon("people-circle", "people-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarLabel: "Messages",
          headerShown: false,
          tabBarIcon: tabIcon("chatbubbles", "chatbubbles-outline"),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Discover",
          tabBarLabel: "Discover",
          tabBarIcon: tabIcon("compass", "compass-outline"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarIcon: tabIcon("grid", "grid-outline"),
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
