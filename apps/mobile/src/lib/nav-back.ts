import type { Href, Router } from "expo-router";

export type NavFrom =
  | "child360"
  | "more"
  | "home"
  | "discover"
  | "messages"
  | string;

/**
 * Leave a tab-root / headerless screen that was opened from another place.
 * Prefers the real stack when it exists; otherwise returns to the origin.
 */
export function leaveToOrigin(
  router: Pick<Router, "back" | "canGoBack" | "replace">,
  options?: {
    from?: NavFrom | null;
    childId?: string | null;
    fallback?: Href;
  }
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  const from = options?.from ?? null;
  const childId = options?.childId ?? null;

  if (from === "child360") {
    if (childId) {
      router.replace({
        pathname: "/(app)/child-360/[childId]",
        params: { childId },
      } as Href);
      return;
    }
    router.replace("/(app)/child-360" as Href);
    return;
  }

  if (from === "more") {
    router.replace("/(app)/profile" as Href);
    return;
  }

  if (from === "home") {
    router.replace("/(app)" as Href);
    return;
  }

  if (from === "discover") {
    router.replace("/(app)/activities" as Href);
    return;
  }

  if (from === "messages") {
    router.replace("/(app)/messages" as Href);
    return;
  }

  router.replace((options?.fallback ?? "/(app)") as Href);
}

export function backLabelForOrigin(from?: NavFrom | null): string {
  switch (from) {
    case "child360":
      return "Child 360";
    case "more":
      return "More";
    case "home":
      return "Home";
    case "discover":
      return "Discover";
    case "messages":
      return "Messages";
    default:
      return "Back";
  }
}
