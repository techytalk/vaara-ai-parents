import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Settings & Privacy" }} />
      <Stack.Screen
        name="notifications"
        options={{ title: "Notification Preferences" }}
      />
      <Stack.Screen name="avatar" options={{ title: "Choose avatar" }} />
    </Stack>
  );
}
