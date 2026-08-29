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

function hashHandle(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function isValidAvatarKey(key: string): key is ParentAvatarKey {
  return (PARENT_AVATAR_KEYS as readonly string[]).includes(key);
}

export function defaultAvatarKeyForHandle(handle: string): ParentAvatarKey {
  return PARENT_AVATAR_KEYS[
    hashHandle(handle || "parent") % PARENT_AVATAR_KEYS.length
  ];
}

/** Use the stored key when set; otherwise derive one from the handle. */
export function resolveAvatarKey(
  stored: string | null | undefined,
  handle: string
): ParentAvatarKey {
  if (stored && isValidAvatarKey(stored)) {
    return stored;
  }
  return defaultAvatarKeyForHandle(handle);
}
