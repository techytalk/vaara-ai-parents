import { AppState } from "react-native";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

const CLIENT_GAP_MS = 5 * 60 * 1000;
let lastSentAt = 0;
let inFlight = false;

async function sendAppOpen(force = false) {
  const now = Date.now();
  if (!force && now - lastSentAt < CLIENT_GAP_MS) return;
  if (inFlight) return;
  const token = await getToken();
  if (!token) return;
  inFlight = true;
  lastSentAt = Date.now();
  try {
    await api.recordAppOpen(token);
  } catch {
    lastSentAt = 0;
  } finally {
    inFlight = false;
  }
}

/** Count a foreground open. Login tokens stay valid; this is a real app open. */
export function startAppOpenTracking() {
  void sendAppOpen();
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void sendAppOpen();
  });
  return () => sub.remove();
}

export function recordAppOpenNow() {
  void sendAppOpen(true);
}
