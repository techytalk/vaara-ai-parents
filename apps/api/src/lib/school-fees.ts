export function currentAcademicYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

export function parseAcademicYearStart(academicYear: string): number | null {
  const match = academicYear.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

export function isFeeYearInRange(academicYear: string, maxYearsBack = 2): boolean {
  const start = parseAcademicYearStart(academicYear);
  if (start == null) return false;
  const currentStart = parseAcademicYearStart(currentAcademicYear());
  if (currentStart == null) return false;
  return start >= currentStart - (maxYearsBack - 1);
}

export function totalFeeAmount(row: {
  tuition_amount: string | number;
  transport_amount?: string | number | null;
  books_uniform_amount?: string | number | null;
  other_amount?: string | number | null;
}): number {
  return (
    Number(row.tuition_amount) +
    Number(row.transport_amount ?? 0) +
    Number(row.books_uniform_amount ?? 0) +
    Number(row.other_amount ?? 0)
  );
}
