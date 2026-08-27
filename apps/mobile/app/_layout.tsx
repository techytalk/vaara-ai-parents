import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { AppQueryProvider } from "@/providers/QueryProvider";

export default function RootLayout() {
  const update = useAppUpdateCheck();

  return (
    <AppQueryProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(provider)" />
        <Stack.Screen name="circles" options={{ headerShown: false }} />
      </Stack>
      <UpdatePrompt
        visible={update.visible}
        forced={update.forced}
        latestVersion={update.latestVersion}
        onUpdate={update.openStore}
        onDismiss={update.dismiss}
      />
    </AppQueryProvider>
  );
}
