import type { Circle } from "@/lib/api";
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";

export function circleCardSubtitle(circle: Circle): string {
  const parts = circle.displayName.split(" · ").map((part) => part.trim());
  const meta = circle.metadata;

  switch (circle.circleType) {
    case "school_class":
      if (parts.length >= 3) {
        return parts[0];
      }
      return CIRCLE_TYPE_LABELS.school_class;
    case "school":
      if (typeof meta.code === "string") {
        return meta.code;
      }
      if (parts.length > 1) {
        return parts.slice(1).join(" · ");
      }
      return CIRCLE_TYPE_LABELS.school;
    case "class":
      if (parts.length >= 2) {
        return parts[parts.length - 1];
      }
      return CIRCLE_TYPE_LABELS.class;
    case "locality":
      if (typeof meta.pin_code === "string") {
        return String(meta.pin_code);
      }
      return CIRCLE_TYPE_LABELS.locality;
    case "community":
      return CIRCLE_TYPE_LABELS.community;
    case "curriculum":
      return CIRCLE_TYPE_LABELS.curriculum;
    default:
      return CIRCLE_TYPE_LABELS[circle.circleType];
  }
}

export function circleCardTitle(circle: Circle): string {
  const parts = circle.displayName.split(" · ").map((part) => part.trim());

  switch (circle.circleType) {
    case "school_class":
      if (parts.length >= 3) {
        return parts.slice(1).join(" · ");
      }
      return circle.displayName;
    case "school":
      return parts[0] ?? circle.displayName;
    default:
      return circle.displayName;
  }
}
