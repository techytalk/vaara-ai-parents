import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { AppQueryProvider } from "@/providers/QueryProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const update = useAppUpdateCheck();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}
