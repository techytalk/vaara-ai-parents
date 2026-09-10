import { Pressable, StyleSheet, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { colors } from "@/constants/theme";

function GoToFeedButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace("/(app)" as never)}
      accessibilityRole="button"
      accessibilityLabel="Go to feed"
      hitSlop={10}
      style={headerStyles.btn}
    >
      <Text style={headerStyles.text}>Go to feed</Text>
    </Pressable>
  );
}

export default function ChildrenLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerRight: () => <GoToFeedButton />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "My children" }} />
      <Stack.Screen name="add" options={{ title: "Add child" }} />
      <Stack.Screen name="edit/[id]" options={{ title: "Edit child" }} />
      <Stack.Screen name="[id]" options={{ title: "Child details" }} />
    </Stack>
  );
}

const headerStyles = StyleSheet.create({
  btn: { paddingHorizontal: 4, paddingVertical: 6 },
  text: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
});
