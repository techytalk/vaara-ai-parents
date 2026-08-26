import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function CirclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "700",
          color: colors.text,
          fontSize: 17,
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="[circleId]/index" options={{ title: "Circle" }} />
      <Stack.Screen name="[circleId]/members" options={{ title: "Members" }} />
      <Stack.Screen name="[circleId]/new-post" options={{ title: "New post" }} />
      <Stack.Screen
        name="[circleId]/posts/[postId]"
        options={{ title: "Discussion" }}
      />
    </Stack>
  );
}
