import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function TourLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        gestureEnabled: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="circles" />
      <Stack.Screen name="ask" />
      <Stack.Screen name="child" />
    </Stack>
  );
}
