let lastChildId: string | null = null;

export function getLastChild360Id(childIds: string[]): string | null {
  if (childIds.length === 0) return null;
  if (lastChildId && childIds.includes(lastChildId)) return lastChildId;
  return childIds[0];
}

export function setLastChild360Id(childId: string | null) {
  lastChildId = childId;
}
