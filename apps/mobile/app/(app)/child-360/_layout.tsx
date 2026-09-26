import { Stack } from "expo-router";
import { colors, typography } from "@/constants/theme";

export default function Child360Layout() {
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
      <Stack.Screen name="index" options={{ title: "Child 360" }} />
      <Stack.Screen name="[childId]/index" options={{ title: "Child 360" }} />
      <Stack.Screen name="[childId]/preschool" options={{ title: "Preschool" }} />
      <Stack.Screen name="[childId]/activities/index" options={{ title: "Activities" }} />
      <Stack.Screen name="[childId]/activities/form" options={{ title: "Activity" }} />
      <Stack.Screen name="[childId]/health/index" options={{ title: "Health" }} />
      <Stack.Screen name="[childId]/health/form" options={{ title: "Health note" }} />
      <Stack.Screen name="[childId]/interests" options={{ title: "Interests" }} />
      <Stack.Screen name="[childId]/pathway-lean" options={{ title: "After Class 10" }} />
      <Stack.Screen
        name="[childId]/opportunities/index"
        options={{ title: "Exams" }}
      />
      <Stack.Screen
        name="[childId]/opportunities/form"
        options={{ title: "Exam plan" }}
      />
    </Stack>
  );
}
