import type { Child, Circle } from "@/lib/api";
import { CIRCLE_TYPE_LABELS } from "@/constants/circles";

const circlePriority: Circle["circleType"][] = [
  "school_class",
  "class",
  "school",
  "community",
  "locality",
  "curriculum",
];

export type CircleGroup = {
  key: string;
  title: string;
  items: Circle[];
};

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Whether this circle is derived from the given child's school / board / class. */
export function circleBelongsToChild(circle: Circle, child: Child): boolean {
  const meta = circle.metadata ?? {};
  switch (circle.circleType) {
    case "school":
      return metaString(meta, "school_id") === child.schoolId;
    case "school_class":
      return (
        metaString(meta, "school_id") === child.schoolId &&
        metaString(meta, "curriculum_id") === child.curriculumId &&
        metaString(meta, "grade_id") === child.gradeId
      );
    case "class":
      return (
        metaString(meta, "curriculum_id") === child.curriculumId &&
        metaString(meta, "grade_id") === child.gradeId
      );
    case "curriculum":
      return metaString(meta, "curriculum_id") === child.curriculumId;
    default:
      return false;
  }
}

function groupByCircleType(circles: Circle[]): CircleGroup[] {
  const sorted = [...circles].sort(
    (a, b) =>
      circlePriority.indexOf(a.circleType) - circlePriority.indexOf(b.circleType)
  );
  const groups: CircleGroup[] = [];
  for (const type of circlePriority) {
    const items = sorted.filter((circle) => circle.circleType === type);
    if (items.length > 0) {
      groups.push({
        key: type,
        title: CIRCLE_TYPE_LABELS[type],
        items,
      });
    }
  }
  return groups;
}

/**
 * One child: keep the familiar type sections.
 * Multiple children: section per child for uniquely matched circles, plus Shared
 * for locality / community / circles that match more than one child.
 */
export function groupCirclesForDisplay(
  circles: Circle[],
  children: Child[]
): CircleGroup[] {
  if (children.length <= 1) {
    return groupByCircleType(circles);
  }

  const matchCounts = new Map<string, Child[]>();
  for (const circle of circles) {
    matchCounts.set(
      circle.id,
      children.filter((child) => circleBelongsToChild(circle, child))
    );
  }

  const groups: CircleGroup[] = [];
  const assigned = new Set<string>();

  for (const child of children) {
    const items = circles.filter((circle) => {
      const matches = matchCounts.get(circle.id) ?? [];
      return matches.length === 1 && matches[0]?.id === child.id;
    });
    for (const item of items) assigned.add(item.id);
    if (items.length > 0) {
      const label = child.nickname?.trim() || "Your child";
      groups.push({
        key: `child-${child.id}`,
        title: label,
        items: [...items].sort(
          (a, b) =>
            circlePriority.indexOf(a.circleType) -
            circlePriority.indexOf(b.circleType)
        ),
      });
    }
  }

  const shared = circles.filter((circle) => !assigned.has(circle.id));
  if (shared.length > 0) {
    groups.push({
      key: "shared",
      title: "Shared",
      items: [...shared].sort(
        (a, b) =>
          circlePriority.indexOf(a.circleType) -
          circlePriority.indexOf(b.circleType)
      ),
    });
  }

  return groups;
}
