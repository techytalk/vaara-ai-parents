import { consumePendingLink } from "@/lib/pending-link";
import type { Router } from "expo-router";
import { api, type AuthResponse, type AuthUser } from "@/lib/api";
import { getToken } from "@/lib/session";
import {
  setOnboardingChildren,
  setOnboardingLocation,
  setOnboardingUser,
} from "@/lib/onboarding-draft";

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
  setOnboardingLocation(loc, { loaded: true });
  setOnboardingChildren(kids);
  if (!loc) return "/onboarding/location";
  if (kids.length === 0) return "/onboarding/school";
  return "/onboarding/ready";
}

/** Brand-new parents have no location or children yet — skip the probe round trips. */
export async function routeNewParentOnboarding(
  router: Router,
  user: AuthUser
): Promise<void> {
  setOnboardingUser(user);
  setOnboardingLocation(null, { loaded: true });
  setOnboardingChildren([]);
  router.replace("/onboarding/location" as never);
}

export async function routeAfterAuth(
  router: Router,
  user: AuthUser,
  options?: { isNewUser?: boolean }
) {
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

  if (options?.isNewUser) {
    await routeNewParentOnboarding(router, user);
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

export function shouldRouteAsNewParent(result: AuthResponse): boolean {
  return Boolean(result.isNewUser) && result.user.role === "parent";
}
