import { Stack } from "expo-router";

export default function ParentActivitiesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Activities near you" }} />
      <Stack.Screen name="[id]" options={{ title: "Activity" }} />
    </Stack>
  );
}
