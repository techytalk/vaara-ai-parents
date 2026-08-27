import type { Router } from "expo-router";
import type { AuthUser } from "@/lib/api";

export function routeAfterAuth(router: Router, user: AuthUser) {
  if (user.onboardingComplete) {
    router.replace(user.role === "provider" ? "/(provider)" : "/(app)");
    return;
  }

  if (user.role === "provider") {
    router.replace("/onboarding/provider");
    return;
  }

  router.replace("/onboarding/children");
}
