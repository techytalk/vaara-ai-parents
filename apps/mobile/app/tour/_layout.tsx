import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";

export default function TourLayout() {
  return (
    // Every tour screen hides the header, so the group owns both insets.
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "bottom"]}
    >
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
    </SafeAreaView>
  );
}
