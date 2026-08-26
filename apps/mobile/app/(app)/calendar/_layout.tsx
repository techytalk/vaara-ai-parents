import { Stack } from "expo-router";

export default function CalendarLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "School calendar" }} />
      <Stack.Screen name="new" options={{ title: "Report event" }} />
    </Stack>
  );
}
