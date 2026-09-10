import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="location"
        options={{ title: "Your location", headerBackVisible: false }}
      />
      <Stack.Screen name="school" options={{ title: "Your child's school" }} />
      <Stack.Screen name="class" options={{ title: "Board and class" }} />
      <Stack.Screen
        name="ready"
        options={{ title: "You're in", headerBackVisible: false }}
      />
      <Stack.Screen
        name="children"
        options={{ headerShown: false, title: "Your children" }}
      />
      <Stack.Screen
        name="provider"
        options={{ title: "Your organization", headerBackVisible: false }}
      />
    </Stack>
  );
}
