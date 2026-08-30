/** Local calendar date as YYYY-MM-DD (API / Postgres `date`). */
export function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatChildDob(value: string): string {
  return parseIsoDateOnly(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Default picker value when adding a school-age child (~7 years old). */
export function defaultChildDob(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function childDobBounds(): { minimumDate: Date; maximumDate: Date } {
  const maximumDate = new Date();
  maximumDate.setHours(0, 0, 0, 0);
  const minimumDate = new Date(maximumDate);
  minimumDate.setFullYear(minimumDate.getFullYear() - 25);
  return { minimumDate, maximumDate };
}
