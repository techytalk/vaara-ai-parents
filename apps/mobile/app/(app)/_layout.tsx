import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "@/constants/theme";
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
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "home", "home-outline")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "My Circles",
          tabBarLabel: "Circles",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "people", "people-outline")({ color, size }),
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
        name="schools"
        options={{
          title: "Schools",
          tabBarLabel: "Schools",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "school", "school-outline")({
              color,
              size,
            }),
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
      <Tabs.Screen
        name="profile"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "grid", "grid-outline")({
              color,
              size,
            }),
        }}
      />
      <Tabs.Screen name="messages" options={{ href: null, headerShown: false }} />
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
    </Tabs>
  );
}
