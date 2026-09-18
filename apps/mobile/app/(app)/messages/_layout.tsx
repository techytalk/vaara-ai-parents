import { Stack } from "expo-router";

export default function MessagesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New message" }} />
      <Stack.Screen name="[conversationId]" options={{ title: "Chat" }} />
      <Stack.Screen name="groups/[circleId]/index" options={{ title: "Group" }} />
      <Stack.Screen name="threads/[threadId]" options={{ title: "Thread" }} />
      <Stack.Screen name="channels/[providerId]" options={{ title: "Tutor" }} />
    </Stack>
  );
}
