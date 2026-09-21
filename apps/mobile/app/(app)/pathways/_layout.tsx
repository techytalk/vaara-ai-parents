import { Stack } from "expo-router";
import { pathTheme } from "@/constants/path-theme";
import { typography } from "@/constants/theme";

export default function PathwaysLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: pathTheme.navTitle,
        headerStyle: { backgroundColor: pathTheme.bg },
        headerTitleStyle: {
          fontFamily: typography.bold,
          color: pathTheme.navTitle,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: pathTheme.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[slug]" options={{ title: "Details" }} />
    </Stack>
  );
}
