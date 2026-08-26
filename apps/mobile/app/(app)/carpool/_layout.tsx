import { Stack } from "expo-router";

export default function CarpoolLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Carpool" }} />
      <Stack.Screen
        name="arrangement/[id]"
        options={{ title: "Carpool arrangement" }}
      />
    </Stack>
  );
}
