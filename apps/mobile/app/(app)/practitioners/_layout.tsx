import { Stack } from "expo-router";

export default function PractitionersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Local doctors" }} />
      <Stack.Screen name="[id]" options={{ title: "Practitioner" }} />
    </Stack>
  );
}
