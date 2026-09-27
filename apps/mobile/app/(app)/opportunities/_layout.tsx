import { Stack } from "expo-router";
import { colors, typography } from "@/constants/theme";

export default function OpportunitiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: {
          fontFamily: typography.bold,
          color: colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Competitive exams" }} />
      <Stack.Screen name="[slug]" options={{ title: "Exam" }} />
    </Stack>
  );
}
