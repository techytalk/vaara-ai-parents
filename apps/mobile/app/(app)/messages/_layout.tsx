import { Stack } from "expo-router";

export default function MessagesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New message" }} />
      <Stack.Screen name="[conversationId]" options={{ title: "Chat" }} />
    </Stack>
  );
}
