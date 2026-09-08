import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, tabBarStyleForInsets, typography } from "@/constants/theme";
import { useBottomChromeInset } from "@/hooks/useBottomChromeInset";

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
  const bottomInset = useBottomChromeInset();

  return (
    <Tabs
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
        tabBarItemStyle: { paddingVertical: 2 },
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
