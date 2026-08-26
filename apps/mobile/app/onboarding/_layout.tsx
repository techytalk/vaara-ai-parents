import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="children"
        options={{ headerShown: false, title: "Your children" }}
      />
      <Stack.Screen
        name="add-children"
        options={{ headerShown: false, title: "Your children" }}
      />
      <Stack.Screen name="location" options={{ title: "Your location" }} />
      <Stack.Screen
        name="provider"
        options={{ title: "Your organization", headerBackVisible: false }}
      />
    </Stack>
  );
}
