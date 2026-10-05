import { db } from "@/lib/db";
import { AppPermission, requirePermission } from "@/lib/permissions";

/**
 * Operating Timezone: Nigeria (WAT / Africa/Lagos = UTC+1)
 */
export const BRANCH_TIMEZONE = "Africa/Lagos";

/**
 * Standard Shift Policies
 * Start: 08:00 AM | Grace Period: 15 mins (up to 08:15 AM is ON TIME)
 * End: 17:00 PM (05:00 PM)
 */
export const SHIFT_POLICY = {
  standardStartHour: 8,
  standardStartMinute: 0,
  gracePeriodMinutes: 15,
  standardEndHour: 17,
  standardEndMinute: 0,
};

/**
 * Extracts the calendar date (YYYY-MM-DD) in the Nigerian business timezone.
 */
export function getBusinessDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRANCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10); // 1-12
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  return { year, month, day, hour, minute, second };
}

/**
 * Returns a normalized UTC midnight Date representing the Nigerian business workDate (YYYY-MM-DD).
 * Suitable for Postgres @db.Date column comparison.
 */
export function getNormalizedWorkDate(date: Date = new Date()): Date {
  const { year, month, day } = getBusinessDateParts(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Parses an arbitrary ISO or YYYY-MM-DD date string into a normalized workDate.
 */
export function parseWorkDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/**
 * Determines whether a clock-in time is considered On Time or Late based on branch policy.
 */
export function evaluateShiftStatus(
  clockInDate: Date,
  branchPolicy?: { openingTime?: string | null; gracePeriodMinutes?: number | null }
): "PRESENT" | "LATE" {
  const { hour, minute } = getBusinessDateParts(clockInDate);
  const clockInMinutes = hour * 60 + minute;

  let startHour = SHIFT_POLICY.standardStartHour;
  let startMinute = SHIFT_POLICY.standardStartMinute;

  if (branchPolicy?.openingTime) {
    const [h, m] = branchPolicy.openingTime.split(":").map(Number);
    if (!isNaN(h)) startHour = h;
    if (!isNaN(m)) startMinute = m;
  }

  const graceMinutes =
    branchPolicy?.gracePeriodMinutes !== undefined && branchPolicy?.gracePeriodMinutes !== null
      ? branchPolicy.gracePeriodMinutes
      : SHIFT_POLICY.gracePeriodMinutes;

  const cutoffMinutes = startHour * 60 + startMinute + graceMinutes;

  return clockInMinutes > cutoffMinutes ? "LATE" : "PRESENT";
}

/**
 * Formats 24h "HH:mm" time string into 12h display like "8:00 AM".
 */
export function formatTimeDisplay(timeStr?: string | null): string {
  if (!timeStr) return "08:00 AM";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return "08:00 AM";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  const mPadded = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mPadded} ${ampm}`;
}

/**
 * Computes the late cutoff time display string given opening time and grace period.
 */
export function getGraceCutoffDisplay(openingTime: string = "08:00", graceMinutes: number = 15): string {
  const [hStr, mStr] = openingTime.split(":");
  let h = parseInt(hStr, 10) || 8;
  let m = (parseInt(mStr, 10) || 0) + graceMinutes;

  h += Math.floor(m / 60);
  m = m % 60;

  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;
  const mPadded = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mPadded} ${ampm}`;
}

/**
 * Calculates shift duration in minutes.
 */
export function calculateShiftDuration(
  clockIn: Date,
  clockOut?: Date | null
): number | null {
  if (!clockOut) return null;
  const diffMs = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60)));
}

