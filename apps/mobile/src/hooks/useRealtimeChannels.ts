import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { REALTIME_URL } from "@/constants/realtime";
import { getToken } from "@/lib/session";

type RealtimeMessage = {
  channel?: string;
  event?: {
    type: string;
    postId?: string;
    circleId?: string;
  };
};

type UseRealtimeChannelsOptions = {
  channels: string[];
  enabled?: boolean;
  onEvent: (event: NonNullable<RealtimeMessage["event"]>, channel: string) => void;
  pollFallbackMs?: number;
  onPollFallback?: () => void;
};

export function useRealtimeChannels({
  channels,
  enabled = true,
  onEvent,
  pollFallbackMs = 60_000,
  onPollFallback,
}: UseRealtimeChannelsOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const channelsKey = channels.join("\0");

  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const socketRef: { current: WebSocket | null } = { current: null };
    const activeChannels = new Set<string>();

    async function connect() {
      const token = await getToken();
      if (!token || closed) return;

      const url = `${REALTIME_URL}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        for (const channel of channels) {
          socket.send(JSON.stringify({ type: "subscribe", channel }));
          activeChannels.add(channel);
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as RealtimeMessage;
          if (payload.event && payload.channel) {
            onEventRef.current(payload.event, payload.channel);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        activeChannels.clear();
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
        activeChannels.clear();
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
      const socket = socketRef.current;
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          for (const channel of activeChannels) {
            socket.send(JSON.stringify({ type: "unsubscribe", channel }));
          }
        }
        socket.close();
        socketRef.current = null;
      }
      activeChannels.clear();
    };
  }, [channelsKey, enabled, pollFallbackMs, onPollFallback]);
}
