import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | { realtimeUrl?: string }
  | undefined;

export const REALTIME_URL =
  process.env.EXPO_PUBLIC_REALTIME_URL ??
  extra?.realtimeUrl ??
  "ws://localhost:3002/ws";
