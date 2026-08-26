import { Stack } from "expo-router";

export default function TopicsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Topics" }} />
      <Stack.Screen name="[slug]" options={{ title: "Topic" }} />
    </Stack>
  );
}
