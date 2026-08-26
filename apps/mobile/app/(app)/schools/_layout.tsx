import { Stack } from "expo-router";

export default function SchoolsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Schools" }} />
      <Stack.Screen name="[id]" options={{ title: "School profile" }} />
      <Stack.Screen name="review" options={{ title: "Write a review" }} />
    </Stack>
  );
}
