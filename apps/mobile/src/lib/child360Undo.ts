/** Short-lived Undo after removing a Child 360 row. Leaving the list drops it. */

export type Child360UndoActivity = {
  kind: "activity";
  childId: string;
  name: string;
  setting: string;
  howOften: string | null;
  status: string;
};

export type Child360UndoHealth = {
  kind: "health";
  childId: string;
  label: string;
  body: string;
};

export type Child360UndoOpportunity = {
  kind: "opportunity";
  childId: string;
  opportunitySlug: string;
  status: string;
  targetYear: number | null;
};

export type Child360UndoPayload =
  | Child360UndoActivity
  | Child360UndoHealth
  | Child360UndoOpportunity;

const TTL_MS = 8_000;

let pending: { payload: Child360UndoPayload; expiresAt: number } | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function setChild360Undo(payload: Child360UndoPayload) {
  pending = { payload, expiresAt: Date.now() + TTL_MS };
  notify();
  setTimeout(() => {
    if (pending && pending.expiresAt <= Date.now()) {
      pending = null;
      notify();
    }
  }, TTL_MS + 50);
}

export function peekChild360Undo(
  childId: string,
  kind: Child360UndoPayload["kind"]
): Child360UndoPayload | null {
  if (!pending) return null;
  if (pending.expiresAt <= Date.now()) {
    pending = null;
    return null;
  }
  if (pending.payload.childId !== childId || pending.payload.kind !== kind) {
    return null;
  }
  return pending.payload;
}

export function clearChild360Undo() {
  if (!pending) return;
  pending = null;
  notify();
}

export function takeChild360Undo(
  childId: string,
  kind: Child360UndoPayload["kind"]
): Child360UndoPayload | null {
  const value = peekChild360Undo(childId, kind);
  if (!value) return null;
  pending = null;
  notify();
  return value;
}

export function subscribeChild360Undo(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function child360UndoTtlMs() {
  return TTL_MS;
}
