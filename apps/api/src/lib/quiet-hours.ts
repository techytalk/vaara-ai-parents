import type { NotificationPrefs } from "./notification-prefs.js";

export type QuietHoursConfig = {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
};

const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  start: "22:00",
  end: "07:00",
  timezone: "Asia/Kolkata",
};

function parseMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function getQuietHours(
  prefs: NotificationPrefs | null | undefined
): QuietHoursConfig {
  const stored = prefs?.quiet_hours;
  return {
    enabled: stored?.enabled !== false,
    start: stored?.start ?? DEFAULT_QUIET_HOURS.start,
    end: stored?.end ?? DEFAULT_QUIET_HOURS.end,
    timezone: stored?.timezone ?? DEFAULT_QUIET_HOURS.timezone,
  };
}

export function isInQuietHours(
  prefs: NotificationPrefs | null | undefined,
  now = new Date()
): boolean {
  const config = getQuietHours(prefs);
  if (!config.enabled) return false;

  const minutes = minutesInTimezone(now, config.timezone);
  const start = parseMinutes(config.start);
  const end = parseMinutes(config.end);

  if (start === end) return false;
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
}

export function nextAllowedPushTime(
  prefs: NotificationPrefs | null | undefined,
  now = new Date()
): Date {
  if (!isInQuietHours(prefs, now)) return now;

  const config = getQuietHours(prefs);
  const endMinutes = parseMinutes(config.end);
  const currentMinutes = minutesInTimezone(now, config.timezone);
  const startMinutes = parseMinutes(config.start);

  let minutesUntilEnd: number;
  if (startMinutes < endMinutes) {
    minutesUntilEnd = endMinutes - currentMinutes;
  } else if (currentMinutes >= startMinutes) {
    minutesUntilEnd = 24 * 60 - currentMinutes + endMinutes;
  } else {
    minutesUntilEnd = endMinutes - currentMinutes;
  }

  return new Date(now.getTime() + minutesUntilEnd * 60_000);
}
