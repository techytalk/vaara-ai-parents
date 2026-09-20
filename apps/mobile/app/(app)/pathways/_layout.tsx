import { Stack } from "expo-router";
import { colors, typography } from "@/constants/theme";

export default function PathwaysLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: typography.bold, color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Child's Path" }} />
      <Stack.Screen name="[slug]" options={{ title: "Details" }} />
    </Stack>
  );
}
