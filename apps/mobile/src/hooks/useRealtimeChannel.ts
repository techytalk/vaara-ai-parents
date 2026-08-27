import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { REALTIME_URL } from "@/constants/realtime";
import { getToken } from "@/lib/session";

type RealtimeMessage = {
  channel?: string;
  event?: {
    type: string;
    postId?: string;
    messageId?: string;
    conversationId?: string;
    circleId?: string;
  };
  type?: string;
};

type UseRealtimeChannelOptions = {
  channel: string | null;
  enabled?: boolean;
  onEvent: (event: NonNullable<RealtimeMessage["event"]>) => void;
  pollFallbackMs?: number;
  onPollFallback?: () => void;
};

export function useRealtimeChannel({
  channel,
  enabled = true,
  onEvent,
  pollFallbackMs = 60_000,
  onPollFallback,
}: UseRealtimeChannelOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !channel) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function connect() {
      const token = await getToken();
      if (!token || closed) return;

      const url = `${REALTIME_URL}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "subscribe", channel }));
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as RealtimeMessage;
          if (payload.event) {
            onEventRef.current(payload.event);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
          if (onPollFallback && !pollTimer) {
            pollTimer = setInterval(onPollFallback, pollFallbackMs);
          }
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    function handleAppState(state: AppStateStatus) {
      if (state === "active" && !socketRef.current) {
        connect().catch(() => {});
      }
      if (state !== "active" && socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    }

    connect().catch(() => {
      if (onPollFallback) {
        pollTimer = setInterval(onPollFallback, pollFallbackMs);
      }
    });

    const appStateSub = AppState.addEventListener("change", handleAppState);

    return () => {
      closed = true;
      appStateSub.remove();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (socketRef.current) {
        socketRef.current.send(
          JSON.stringify({ type: "unsubscribe", channel })
        );
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [channel, enabled, pollFallbackMs, onPollFallback]);
}
