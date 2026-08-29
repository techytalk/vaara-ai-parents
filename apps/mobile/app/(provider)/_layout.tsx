import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "@/constants/theme";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(
  focused: boolean,
  active: TabIconName,
  inactive: TabIconName
) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function ProviderLayout() {
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
        tabBarStyle: {
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: typography.semibold,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "grid", "grid-outline")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activities",
          tabBarLabel: "Activities",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "calendar", "calendar-outline")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "person", "person-outline")({ color, size }),
        }}
      />
    </Tabs>
  );
}
