const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseChildDateOfBirth(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return null;
  }

  const minimum = new Date(today);
  minimum.setFullYear(minimum.getFullYear() - 25);
  if (date < minimum) {
    return null;
  }

  return value;
}

export function formatChildDateOfBirth(
  value: unknown
): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    return parseChildDateOfBirth(value);
  }
  return null;
}
