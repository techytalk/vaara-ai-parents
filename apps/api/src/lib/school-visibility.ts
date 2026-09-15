/** Shared school visibility: verified OR owned by the current user. */
export const SCHOOL_VISIBLE_SQL = `(s.verified = true OR s.created_by_user_id = $USER)`;

export function schoolVisiblePredicate(
  userParam: number,
  alias = "s"
): string {
  return `(${alias}.verified = true OR ${alias}.created_by_user_id = $${userParam})`;
}

export function schoolNotRedirected(alias = "s"): string {
  return `${alias}.redirect_to_school_id IS NULL`;
}

export const PLACEHOLDER_SCHOOL_KEY = "school_not_specified||unknown";

export function schoolNotPlaceholder(alias = "s"): string {
  return `${alias}.normalized_key <> '${PLACEHOLDER_SCHOOL_KEY}'`;
}
