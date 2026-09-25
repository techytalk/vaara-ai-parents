import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography } from "@/constants/theme";

export default function OnboardingLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: typography.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="location"
          options={{ title: "Your location", headerBackVisible: false }}
        />
        <Stack.Screen name="school" options={{ title: "Your child's school" }} />
        <Stack.Screen name="age" options={{ title: "Age circle" }} />
        <Stack.Screen name="class" options={{ title: "Board and class" }} />
        <Stack.Screen
          name="ready"
          options={{ title: "You're connected", headerBackVisible: false }}
        />
        <Stack.Screen
          name="children"
          options={{ headerShown: false, title: "Your children" }}
        />
        <Stack.Screen
          name="provider"
          options={{ title: "Your organization", headerBackVisible: false }}
        />
      </Stack>
    </SafeAreaView>
  );
}
