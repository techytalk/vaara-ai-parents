import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
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
import { useOTAUpdates } from "@/hooks/useOTAUpdates";
import { AppQueryProvider } from "@/providers/QueryProvider";
import { ReportProvider } from "@/providers/ReportProvider";
import { colors } from "@/constants/theme";
import { initAnalytics } from "@/lib/analytics";
import { pathFromShareUrl, savePendingLink } from "@/lib/pending-link";
import { getToken } from "@/lib/session";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const update = useAppUpdateCheck();
  useOTAUpdates();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    void initAnalytics();
  }, []);

  useEffect(() => {
    function handleUrl(url: string) {
      const path = pathFromShareUrl(url);
      if (!path) return;
      getToken().then((token) => {
        if (!token) savePendingLink(path).catch(() => {});
      });
    }
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const sub = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppErrorBoundary>
      <AppQueryProvider>
        <ReportProvider>
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
          <Stack.Screen name="p" options={{ headerShown: false }} />
        </Stack>
        <UpdatePrompt
          visible={update.visible}
          forced={update.forced}
          latestVersion={update.latestVersion}
          onUpdate={update.openStore}
          onDismiss={update.dismiss}
        />
        </ReportProvider>
      </AppQueryProvider>
    </AppErrorBoundary>
  );
}
