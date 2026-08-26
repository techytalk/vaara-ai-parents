export function normalizeCommunityKey(communityName: string): string {
  return communityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
