import type { Ionicons } from "@expo/vector-icons";

const DIGEST_TYPES = new Set([
  "circle_post",
  "topic_digest",
  "school_event",
  "activity_nearby",
  "listing_interest",
]);

export function isDigestNotification(type: string): boolean {
  return DIGEST_TYPES.has(type);
}

export function notificationIcon(
  type: string
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "direct_message":
    case "connection_request":
      return "chatbubble-outline";
    case "circle_reply":
      return "return-down-back-outline";
    case "disclosure_request":
    case "disclosure_accepted":
      return "id-card-outline";
    case "carpool_update":
      return "car-outline";
    case "expert_session":
      return "school-outline";
    case "reminder":
      return "alarm-outline";
    case "playdate_interest":
      return "happy-outline";
    case "topic_digest":
      return "pricetags-outline";
    case "activity_nearby":
      return "compass-outline";
    case "listing_interest":
      return "storefront-outline";
  }
  return "notifications-outline";
}
