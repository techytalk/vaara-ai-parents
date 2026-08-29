import type { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { FEATURE_FLAGS } from "@/constants/features";

export type DiscoveryShortcut = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const CORE_SHORTCUTS: DiscoveryShortcut[] = [
  {
    key: "activities",
    label: "Discover",
    icon: "compass-outline",
    color: colors.amber,
    route: "/(app)/activities",
  },
  {
    key: "schools",
    label: "Schools",
    icon: "school-outline",
    color: colors.primary,
    route: "/(app)/schools",
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: "calendar-outline",
    color: colors.coral,
    route: "/(app)/calendar",
  },
  {
    key: "experts",
    label: "Experts",
    icon: "shield-checkmark-outline",
    color: colors.navy,
    route: "/(app)/experts",
  },
];

const DOCTORS_SHORTCUT: DiscoveryShortcut = {
  key: "practitioners",
  label: "Doctors",
  icon: "medkit-outline",
  color: colors.teal,
  route: "/(app)/practitioners",
};

const PLAYDATES_SHORTCUT: DiscoveryShortcut = {
  key: "playdates",
  label: "Playdates",
  icon: "happy-outline",
  color: colors.lavender,
  route: "/(app)/playdates",
};

const CARPOOL_SHORTCUT: DiscoveryShortcut = {
  key: "carpool",
  label: "Carpool",
  icon: "car-outline",
  color: colors.primaryDark,
  route: "/(app)/carpool",
};

/** Shortcuts shown on the Circles overview and similar discovery hubs. */
export function getDiscoveryShortcuts(): DiscoveryShortcut[] {
  const shortcuts = [...CORE_SHORTCUTS];
  if (FEATURE_FLAGS.showDoctors) {
    shortcuts.push(DOCTORS_SHORTCUT);
  }
  if (FEATURE_FLAGS.showPlaydates) {
    shortcuts.push(PLAYDATES_SHORTCUT);
  }
  if (FEATURE_FLAGS.showCarpool) {
    shortcuts.push(CARPOOL_SHORTCUT);
  }
  return shortcuts;
}

/** Coordination features surfaced in Discover and More. */
export function getCoordinationShortcuts(): DiscoveryShortcut[] {
  const shortcuts: DiscoveryShortcut[] = [];
  if (FEATURE_FLAGS.showDoctors) {
    shortcuts.push(DOCTORS_SHORTCUT);
  }
  if (FEATURE_FLAGS.showPlaydates) {
    shortcuts.push(PLAYDATES_SHORTCUT);
  }
  if (FEATURE_FLAGS.showCarpool) {
    shortcuts.push(CARPOOL_SHORTCUT);
  }
  return shortcuts;
}
