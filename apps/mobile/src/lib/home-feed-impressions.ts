import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, type ViewToken } from "react-native";
import { api } from "./api";
import { getToken } from "./session";

const FLUSH_MS = 2000;
const FLUSH_AT = 20;
const MAX_BATCH = 50;

export const HOME_FEED_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 750,
};

export function useHomeFeedImpressions() {
  const acceptedRef = useRef(new Set<string>());
  const pendingRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    if (sendingRef.current) return;
    const ids = [...pendingRef.current].slice(0, MAX_BATCH);
    if (ids.length === 0) return;
    sendingRef.current = true;
    clearTimer();
    for (const id of ids) pendingRef.current.delete(id);
    try {
      const token = await getToken();
      if (!token) return;
      await api.recordHomeFeedImpressions(token, ids);
    } catch (error) {
      const status =
        error instanceof Error && "status" in error
          ? Number((error as Error & { status?: number }).status)
          : undefined;
      if (status === 401 || status === 403) {
        return;
      }
      for (const id of ids) pendingRef.current.add(id);
    } finally {
      sendingRef.current = false;
      if (pendingRef.current.size > 0) {
        timerRef.current = setTimeout(() => {
          void flush();
        }, FLUSH_MS);
      }
    }
  }, [clearTimer]);

  const scheduleFlush = useCallback(() => {
    if (pendingRef.current.size >= FLUSH_AT) {
      void flush();
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        void flush();
      }, FLUSH_MS);
    }
  }, [flush]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      let added = false;
      for (const token of viewableItems) {
        const id = token.item?.id;
        if (typeof id !== "string" || acceptedRef.current.has(id)) continue;
        acceptedRef.current.add(id);
        pendingRef.current.add(id);
        added = true;
      }
      if (added) scheduleFlush();
    },
    [scheduleFlush]
  );

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") {
        void flush();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => {
      sub.remove();
      clearTimer();
      void flush();
    };
  }, [clearTimer, flush]);

  return { onViewableItemsChanged };
}
