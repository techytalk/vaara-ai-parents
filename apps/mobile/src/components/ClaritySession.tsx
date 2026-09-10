import { useEffect } from "react";
import { usePathname, useSegments } from "expo-router";
import {
  syncClarityUserFromSession,
  trackClarityScreen,
} from "@/lib/clarity";

export function ClaritySession() {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    void trackClarityScreen(segments, pathname);
    void syncClarityUserFromSession();
  }, [pathname, segments]);

  return null;
}
