/**
 * Analytics-ready event tracking. Wire a provider SDK here when available.
 * Never include child data, message contents, or access tokens in properties.
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
  | "market_listing_opened";

type AnalyticsProperties = Record<string, string | number | boolean>;

export function trackEvent(
  name: AnalyticsEvent,
  properties?: AnalyticsProperties
): void {
  if (__DEV__) {
    console.log(`[analytics] ${name}`, properties ?? {});
  }
}
