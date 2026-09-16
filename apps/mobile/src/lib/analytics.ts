/**
 * Google Analytics (GA4) via Firebase Analytics.
 * Google Ads app conversions are imported from these GA4 events after the
 * Firebase project is linked to Google Ads (console-only; no Ads SDK in-app).
 * Never include child data, message contents, emails, or access tokens.
 */

export type AnalyticsEvent =
  | "home_circle_opened"
  | "home_first_open"
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
  | "signup_view"
  | "signup_method_selected"
  | "tutorial_begin"
  | "tutorial_complete"
  | "onboarding_completed"
  | "onboarding_location_view"
  | "onboarding_location_complete"
  | "onboarding_school_view"
  | "onboarding_school_complete"
  | "onboarding_class_view"
  | "onboarding_class_complete"
  | "onboarding_ready_view"
  | "location_updated"
  | "onboarding_children_complete"
  | "onboarding_account_switch"
  | "location_screen_view"
  | "pin_lookup"
  | "area_selected"
  | "shortlist_ready"
  | "shortlist_tapped"
  | "school_query"
  | "school_selected"
  | "school_catalog_ready"
  | "school_create_shown_candidates"
  | "school_search_no_results"
  | "school_create_opened"
  | "school_created"
  | "tour_started"
  | "tour_step_view"
  | "tour_skipped"
  | "tour_completed"
  | "tour_first_post_started"
  | "second_child_prompted"
  | "second_child_added"
  | "completion_prompt_shown"
  | "completion_prompt_tapped"
  | "completion_prompt_dismissed"
  | "school_suggestion_tapped"
  | "share";

type AnalyticsProperties = Record<string, string | number | boolean>;

/** Events intended as Google Ads / GA4 key conversions. */
const CONVERSION_EVENTS = new Set<AnalyticsEvent>([
  "sign_up",
  "login",
  "tutorial_complete",
  "onboarding_completed",
  "share",
]);

async function nativeLog(
  name: string,
  properties?: AnalyticsProperties
): Promise<void> {
  try {
    const analytics = (await import("@react-native-firebase/analytics")).default;
    const instance = analytics();
    const method = String(properties?.method ?? "password");
    // Recommended GA4 event helpers so Ads can import them as conversions.
    if (name === "sign_up") {
      await instance.logSignUp({ method });
      return;
    }
    if (name === "login") {
      await instance.logLogin({ method });
      return;
    }
    if (name === "tutorial_begin") {
      await instance.logTutorialBegin();
      return;
    }
    if (name === "tutorial_complete") {
      await instance.logTutorialComplete();
      return;
    }
    await instance.logEvent(name, properties);
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
  method: "password" | "google" | "apple"
): void {
  trackEvent(type, { method });
}

export function trackOnboardingBegin(): void {
  trackEvent("tutorial_begin");
}

export function trackOnboardingChildrenComplete(): void {
  trackEvent("onboarding_children_complete");
}

/**
 * Conversion: final circles / "You're in" page after school + board + class.
 * Call once when that page successfully loads — not on every remount/revisit.
 * Params must stay non-PII (no email/name/phone).
 */
export function trackOnboardingCompleted(params?: {
  circle_count?: number;
}): void {
  const properties: AnalyticsProperties = {};
  if (typeof params?.circle_count === "number") {
    properties.circle_count = params.circle_count;
  }

  trackEvent("onboarding_completed", properties);
  // GA4 recommended event — also importable as an Ads conversion.
  trackEvent("tutorial_complete");
}

/** @deprecated Prefer trackOnboardingCompleted on the final circles page. */
export function trackOnboardingComplete(): void {
  trackEvent("tutorial_complete");
}

/**
 * Once per account/device: first time the home feed successfully opens.
 * Activation signal after onboarding_completed → See your feed.
 */
export async function trackHomeFirstOpen(
  userId: string,
  params?: {
  circle_count?: number;
  post_count?: number;
  }
): Promise<void> {
  try {
    const SecureStore = await import("expo-secure-store");
    const KEY = `vaara_home_first_open_${userId}`;
    if ((await SecureStore.getItemAsync(KEY)) === "true") return;
    await SecureStore.setItemAsync(KEY, "true");
  } catch {
    // If store fails, still attempt once via caller ref.
  }

  const properties: AnalyticsProperties = {};
  if (typeof params?.circle_count === "number") {
    properties.circle_count = params.circle_count;
  }
  if (typeof params?.post_count === "number") {
    properties.post_count = params.post_count;
  }
  trackEvent("home_first_open", properties);
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
