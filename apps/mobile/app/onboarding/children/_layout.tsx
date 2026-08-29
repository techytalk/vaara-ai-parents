import { Stack } from "expo-router";

export default function ChildrenLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="add" options={{ title: "Add child" }} />
      <Stack.Screen name="edit/[id]" options={{ title: "Edit child" }} />
      <Stack.Screen name="[id]" options={{ title: "Child details" }} />
    </Stack>
  );
}
