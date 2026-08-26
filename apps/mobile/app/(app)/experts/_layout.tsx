import { Stack } from "expo-router";

export default function ExpertsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Expert sessions" }} />
      <Stack.Screen name="[id]" options={{ title: "Session" }} />
    </Stack>
  );
}
