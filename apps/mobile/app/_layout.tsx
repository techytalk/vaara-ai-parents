import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { AppQueryProvider } from "@/providers/QueryProvider";
import { colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const update = useAppUpdateCheck();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppErrorBoundary>
      <AppQueryProvider>
        <StatusBar style="dark" backgroundColor={colors.bg} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(intro)" />
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
