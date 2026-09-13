import type { AuthUser, Child, Circle } from "@/lib/api";
import { clearSession, getToken, saveSession } from "@/lib/session";
import { queryClient } from "@/providers/QueryProvider";

export async function authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return fn(token);
}

export function isUnauthorized(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.message === "Not signed in") {
    return true;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: number }).status) === 401
  ) {
    return true;
  }
  return false;
}

export async function beginAuthenticatedSession(
  token: string,
  user: AuthUser
) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await saveSession(token, user);
  queryClient.setQueryData(["sessionUser"], user);
}

export async function endAuthenticatedSession() {
  await queryClient.cancelQueries();
  await clearSession();
  queryClient.clear();
}

export function seedSessionUser(user: AuthUser) {
  queryClient.setQueryData(["sessionUser"], user);
}

export function seedHomeMeta(input: {
  user?: AuthUser | null;
  circles?: Circle[] | null;
  children?: Child[] | null;
}) {
  if (input.user) {
    queryClient.setQueryData(["sessionUser"], input.user);
  }
  if (input.circles) {
    queryClient.setQueryData(["circles"], input.circles);
  }
  if (input.children) {
    queryClient.setQueryData(["me", "children"], input.children);
  }
}

export function invalidateFamilyMeta(options?: {
  user?: AuthUser;
  children?: boolean;
  circles?: boolean;
}) {
  if (options?.user) {
    queryClient.setQueryData(["sessionUser"], options.user);
  }
  if (options?.circles !== false) {
    void queryClient.invalidateQueries({ queryKey: ["circles"] });
  }
  if (options?.children !== false) {
    void queryClient.invalidateQueries({ queryKey: ["me", "children"] });
  }
}
