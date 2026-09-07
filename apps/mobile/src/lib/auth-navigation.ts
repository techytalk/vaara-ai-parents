import { consumePendingLink } from "@/lib/pending-link";
import type { Router } from "expo-router";
import type { AuthUser } from "@/lib/api";

export async function routeAfterAuth(router: Router, user: AuthUser) {
  const pending = await consumePendingLink();
  if (pending && user.onboardingComplete && user.role !== "provider") {
    router.replace(pending as never);
    return;
  }

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
