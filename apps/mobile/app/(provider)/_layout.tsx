import { Tabs } from "expo-router";

export default function ProviderLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarLabel: "Home" }} />
      <Tabs.Screen
        name="activities"
        options={{ title: "Activities", tabBarLabel: "Activities", headerShown: false }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
    </Tabs>
  );
}
