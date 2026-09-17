import type { ComponentProps } from "react";
import type { Circle } from "@/lib/api";

type IoniconName = ComponentProps<
  typeof import("@expo/vector-icons").Ionicons
>["name"];

export function circleTypeIcon(
  circleType: Circle["circleType"] | string
): IoniconName {
  switch (circleType) {
    case "locality":
    case "age_locality":
      return "home";
    case "community":
      return "business";
    case "school":
    case "school_class":
    case "school_age":
      return "school";
    case "curriculum":
    case "class":
      return "library";
    default:
      return "people";
  }
}
