import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function TourLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="circles"
        options={{ title: "Your circles", headerBackVisible: false }}
      />
      <Stack.Screen name="ask" options={{ title: "Ask anything" }} />
      <Stack.Screen name="child" options={{ title: "Your child" }} />
    </Stack>
  );
}
