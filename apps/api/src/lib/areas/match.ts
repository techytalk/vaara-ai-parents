/**
 * Both sides match on area when each has one.
 * PIN is used only while either side still has a null area_id.
 */
export function sameNearbyAreaSql(viewer: string, other: string): string {
  return `(
    ${viewer}.area_id IS NOT NULL
    AND ${other}.area_id IS NOT NULL
    AND ${viewer}.area_id = ${other}.area_id
  ) OR (
    (${viewer}.area_id IS NULL OR ${other}.area_id IS NULL)
    AND ${viewer}.pin_code IS NOT NULL
    AND ${other}.pin_code IS NOT NULL
    AND ${viewer}.pin_code = ${other}.pin_code
  )`;
}
