import Constants from "expo-constants";
import { Platform } from "react-native";
import type { AuthUser } from "./api";

/** Add `#clarity-mask` in Clarity → Settings → Masking. */
export const CLARITY_MASK_TEST_ID = "clarity-mask";

type ClaritySdk = typeof import("@microsoft/react-native-clarity");

let sdk: ClaritySdk | null | undefined;
let initStarted = false;
let enabled = false;
let latestScreen = "";
let latestFunnel = "";
let latestPath = "";
let latestUser: AuthUser | null | undefined;

function projectId(): string {
  const extra = Constants.expoConfig?.extra as
    | { clarityProjectId?: string }
    | undefined;
  return (
    extra?.clarityProjectId?.trim() ||
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim() ||
    ""
  );
}

async function loadSdk(): Promise<ClaritySdk | null> {
  if (sdk !== undefined) return sdk;
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    sdk = null;
    return null;
  }
  try {
    sdk = await import("@microsoft/react-native-clarity");
    return sdk;
  } catch {
    sdk = null;
    return null;
  }
}

export function funnelFromSegments(segments: readonly string[]): string {
  const root = segments[0];
  if (root === "(auth)") {
    return segments.includes("register") ? "register" : "login";
  }
  if (root === "onboarding") {
    if (segments.includes("location")) return "onboarding_location";
    if (segments.includes("school")) return "onboarding_school";
    if (segments.includes("class")) return "onboarding_class";
    if (segments.includes("ready")) return "onboarding_ready";
    if (segments.includes("provider")) return "onboarding_provider";
    if (segments.includes("children")) return "onboarding_children";
    return "onboarding";
  }
  if (root === "tour") return "tour";
  if (root === "(app)" || root === "circles") return "in_app";
  if (root === "(provider)") return "provider_app";
  if (root === "p") return "shared_post";
  return "other";
}

function applySessionMetadata(Clarity: ClaritySdk) {
  if (latestScreen) void Clarity.setCurrentScreenName(latestScreen);
  if (latestFunnel) void Clarity.setCustomTag("funnel", latestFunnel);
  if (latestPath) void Clarity.setCustomTag("path", latestPath);
  if (latestUser === undefined) return;
  if (!latestUser) {
    void Clarity.setCustomTag("signed_in", "false");
    void Clarity.setCustomTag("onboarded", "false");
    return;
  }
  void Clarity.setCustomUserId(latestUser.anonymousHandle);
  void Clarity.setCustomTag("signed_in", "true");
  void Clarity.setCustomTag(
    "onboarded",
    latestUser.onboardingComplete ? "true" : "false"
  );
  void Clarity.setCustomTag("role", latestUser.role);
}

export async function initClarity(): Promise<void> {
  if (initStarted) return;
  initStarted = true;

  const id = projectId();
  if (!id) {
    if (__DEV__) {
      console.warn(
        "[clarity] Set EXPO_PUBLIC_CLARITY_PROJECT_ID before the next native build"
      );
    }
    return;
  }

  const Clarity = await loadSdk();
  if (!Clarity) return;

  Clarity.initialize(id, {
    logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
  });
  Clarity.setOnSessionStartedCallback(() => {
    applySessionMetadata(Clarity);
  });
  enabled = true;
}

export async function trackClarityScreen(
  segments: readonly string[],
  pathname: string
): Promise<void> {
  await initClarity();
  const Clarity = await loadSdk();
  if (!Clarity || !enabled) return;

  const screen =
    segments.length > 0 ? segments.join("/") : pathname || "index";
  const funnel = funnelFromSegments(segments);
  const path = pathname || "/";
  const funnelChanged = funnel !== latestFunnel;

  latestScreen = screen;
  latestFunnel = funnel;
  latestPath = path;
  applySessionMetadata(Clarity);
  if (funnelChanged) {
    void Clarity.sendCustomEvent(funnel);
  }
}

export async function syncClarityUser(user: AuthUser | null): Promise<void> {
  await initClarity();
  const Clarity = await loadSdk();
  latestUser = user;
  if (!Clarity || !enabled) return;
  applySessionMetadata(Clarity);
}

export async function syncClarityUserFromSession(): Promise<void> {
  const { getStoredUser } = await import("./session");
  await syncClarityUser(await getStoredUser());
}
