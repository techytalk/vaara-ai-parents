import { Stack } from "expo-router";

export default function TopicsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Interests" }} />
      <Stack.Screen name="[slug]" options={{ title: "Interest" }} />
    </Stack>
  );
}
