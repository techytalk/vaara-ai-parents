import { consumePendingLink } from "@/lib/pending-link";
import type { Router } from "expo-router";
import { api, type AuthUser } from "@/lib/api";
import { getToken } from "@/lib/session";

export type ParentOnboardingHref =
  | "/onboarding/location"
  | "/onboarding/school"
  | "/onboarding/ready";

export async function resolveParentOnboardingHref(
  token: string
): Promise<ParentOnboardingHref> {
  const [loc, kids] = await Promise.all([
    api.getLocation(token).catch(() => null),
    api.getChildren(token).catch(() => [] as Awaited<ReturnType<typeof api.getChildren>>),
  ]);
  if (!loc) return "/onboarding/location";
  if (kids.length === 0) return "/onboarding/school";
  return "/onboarding/ready";
}

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

  const token = await getToken();
  if (!token) {
    router.replace("/(auth)/login");
    return;
  }
  const href = await resolveParentOnboardingHref(token);
  router.replace(href as never);
}
