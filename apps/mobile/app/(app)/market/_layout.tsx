import { Stack } from "expo-router";

export default function MarketLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Community market" }} />
      <Stack.Screen name="[id]" options={{ title: "Listing" }} />
      <Stack.Screen name="new" options={{ title: "New listing" }} />
      <Stack.Screen name="mine" options={{ title: "My listings" }} />
    </Stack>
  );
}
