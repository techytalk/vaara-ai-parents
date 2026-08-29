export function normalizeSchoolPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildSchoolNormalizedKey(
  name: string,
  branch: string | null | undefined,
  city: string
): string {
  return `${normalizeSchoolPart(name)}|${normalizeSchoolPart(branch ?? "")}|${normalizeSchoolPart(city)}`;
}

export function formatSchoolLabel(
  name: string,
  branch: string | null | undefined,
  city: string
): string {
  const parts = [name.trim()];
  if (branch?.trim()) parts.push(branch.trim());
  parts.push(city.trim());
  return parts.join(" · ");
}

export function mapSchoolRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    branch: row.branch,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    verified: row.verified,
    displayLabel: formatSchoolLabel(
      String(row.name),
      row.branch as string | null,
      String(row.city)
    ),
  };
}

export function mapSchoolListRow(row: Record<string, unknown>) {
  const ratingCount = Number(row.rating_count ?? 0);
  return {
    ...mapSchoolRow(row),
    ratingAvg:
      ratingCount >= 3 && row.rating_avg != null
        ? Number(row.rating_avg)
        : null,
    ratingCount,
  };
}
