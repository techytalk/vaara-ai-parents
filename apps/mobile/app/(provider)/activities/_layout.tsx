import { Stack } from "expo-router";

export default function ProviderActivitiesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My activities" }} />
      <Stack.Screen name="new" options={{ title: "New activity" }} />
      <Stack.Screen name="[id]" options={{ title: "Edit activity" }} />
    </Stack>
  );
}
