import { Stack } from "expo-router";

export default function ParentActivitiesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Activity" }} />
    </Stack>
  );
}
