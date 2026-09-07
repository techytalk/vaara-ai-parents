/**
 * Google Analytics (GA4) via Firebase Analytics.
 * Google Ads app conversions are imported from these GA4 events after the
 * Firebase project is linked to Google Ads (console-only; no Ads SDK in-app).
 * Never include child data, message contents, emails, or access tokens.
 */

export type AnalyticsEvent =
  | "intro_started"
  | "intro_skipped"
  | "intro_completed"
  | "home_circle_opened"
  | "circles_view_all"
  | "circle_post_started"
  | "circle_post_opened"
  | "circle_post_saved"
  | "circle_poll_voted"
  | "circle_members_opened"
  | "home_shortcut_opened"
  | "notification_center_opened"
  | "more_destination_opened"
  | "market_listing_posted"
  | "market_listing_opened"
  | "sign_up"
  | "login"
  | "tutorial_complete"
  | "share";

type AnalyticsProperties = Record<string, string | number | boolean>;

const CONVERSION_EVENTS = new Set<AnalyticsEvent>([
  "sign_up",
  "login",
  "tutorial_complete",
  "share",
]);

async function nativeLog(
  name: string,
  properties?: AnalyticsProperties
): Promise<void> {
  try {
    const analytics = (await import("@react-native-firebase/analytics")).default;
    await analytics().logEvent(name, properties);
  } catch {
    // Native module is unavailable in Expo Go and on web.
  }
}

export function trackEvent(
  name: AnalyticsEvent,
  properties?: AnalyticsProperties
): void {
  if (__DEV__) {
    console.log(`[analytics] ${name}`, properties ?? {});
  }
  void nativeLog(name, properties);
}

export function trackAuthConversion(
  type: "login" | "sign_up",
  method: "password" | "google"
): void {
  trackEvent(type, { method });
}

export function trackOnboardingComplete(): void {
  trackEvent("tutorial_complete");
}

export function trackShareConversion(contentType = "post"): void {
  trackEvent("share", { content_type: contentType, method: "app" });
}

export async function initAnalytics(): Promise<void> {
  try {
    const analytics = (await import("@react-native-firebase/analytics")).default;
    await analytics().setAnalyticsCollectionEnabled(true);
  } catch {
    // Native module is unavailable in Expo Go and on web.
  }
}

export { CONVERSION_EVENTS };
