import type { ImageSourcePropType } from "react-native";

export const PARENT_AVATAR_KEYS = [
  "parent-01",
  "parent-02",
  "parent-03",
  "parent-04",
  "parent-05",
  "parent-06",
  "parent-07",
  "parent-08",
  "parent-09",
  "parent-10",
  "parent-11",
  "parent-12",
  "parent-13",
  "parent-14",
  "parent-15",
  "parent-16",
] as const;

export type ParentAvatarKey = (typeof PARENT_AVATAR_KEYS)[number];

/** Metro needs static require paths, so the list is written out. */
const PARENT_AVATAR_SOURCES: Record<ParentAvatarKey, ImageSourcePropType> = {
  "parent-01": require("../../assets/avatars/parent-01.png"),
  "parent-02": require("../../assets/avatars/parent-02.png"),
  "parent-03": require("../../assets/avatars/parent-03.png"),
  "parent-04": require("../../assets/avatars/parent-04.png"),
  "parent-05": require("../../assets/avatars/parent-05.png"),
  "parent-06": require("../../assets/avatars/parent-06.png"),
  "parent-07": require("../../assets/avatars/parent-07.png"),
  "parent-08": require("../../assets/avatars/parent-08.png"),
  "parent-09": require("../../assets/avatars/parent-09.png"),
  "parent-10": require("../../assets/avatars/parent-10.png"),
  "parent-11": require("../../assets/avatars/parent-11.png"),
  "parent-12": require("../../assets/avatars/parent-12.png"),
  "parent-13": require("../../assets/avatars/parent-13.png"),
  "parent-14": require("../../assets/avatars/parent-14.png"),
  "parent-15": require("../../assets/avatars/parent-15.png"),
  "parent-16": require("../../assets/avatars/parent-16.png"),
};

function hashHandle(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function isParentAvatarKey(key: string): key is ParentAvatarKey {
  return (PARENT_AVATAR_KEYS as readonly string[]).includes(key);
}

export function defaultAvatarKeyForHandle(handle: string): ParentAvatarKey {
  return PARENT_AVATAR_KEYS[
    hashHandle(handle || "parent") % PARENT_AVATAR_KEYS.length
  ];
}

export function resolveAvatarKey(
  stored: string | null | undefined,
  handle: string
): ParentAvatarKey {
  if (stored && isParentAvatarKey(stored)) {
    return stored;
  }
  return defaultAvatarKeyForHandle(handle);
}

export function parentAvatarSource(
  handle: string,
  avatarKey?: string | null
): ImageSourcePropType {
  return PARENT_AVATAR_SOURCES[resolveAvatarKey(avatarKey, handle)];
}

export function parentAvatarSourceForKey(key: ParentAvatarKey): ImageSourcePropType {
  return PARENT_AVATAR_SOURCES[key];
}
