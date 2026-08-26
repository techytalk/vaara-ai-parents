import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { registerForPushNotifications } from "@/lib/push";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(
  focused: boolean,
  active: TabIconName,
  inactive: TabIconName
) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons
      name={focused ? active : inactive}
      size={size}
      color={color}
    />
  );
}

export default function AppLayout() {
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
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
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "home", "home-outline")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activities",
          tabBarLabel: "Activities",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "compass", "compass-outline")({ color, size }),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarLabel: "Messages",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "chatbubbles", "chatbubbles-outline")({
              color,
              size,
            }),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarLabel: "Alerts",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "notifications", "notifications-outline")({
              color,
              size,
            }),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          tabBarLabel: "Account",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "person-circle", "person-circle-outline")({
              color,
              size,
            }),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{ href: null, title: "Reminders" }}
      />
    </Tabs>
  );
}
