import { Stack } from "expo-router";
import { colors, typography } from "@/constants/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Vaara Parents",
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: typography.semibold },
        headerShadowVisible: false,
        statusBarStyle: "dark",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign in" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
    </Stack>
  );
}
