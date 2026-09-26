import { useCallback, useEffect, useState } from "react";
import {
  peekChild360Undo,
  subscribeChild360Undo,
  takeChild360Undo,
  type Child360UndoPayload,
} from "@/lib/child360Undo";

export function useChild360Undo(
  childId: string,
  kind: Child360UndoPayload["kind"]
) {
  const [undo, setUndo] = useState<Child360UndoPayload | null>(() =>
    peekChild360Undo(childId, kind)
  );

  useEffect(() => {
    const sync = () => setUndo(peekChild360Undo(childId, kind));
    sync();
    return subscribeChild360Undo(sync);
  }, [childId, kind]);

  const take = useCallback(() => {
    const value = takeChild360Undo(childId, kind);
    setUndo(null);
    return value;
  }, [childId, kind]);

  return { undo, take };
}
