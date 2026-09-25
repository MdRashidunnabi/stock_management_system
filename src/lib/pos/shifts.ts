/**
 * Shop shifts and till limits.
 *
 * One branch may run up to 10 tills at a time. Each till takes its own sales
 * and payments. The cashier closes that till (count cash) at the end of a
 * shift; the same till can then be opened for the next shift. Final
 * accounting is shift-wide (Morning / Evening / Night) and can be run any
 * time — it rolls up every till that worked that shift.
 */

export const MAX_TILLS_PER_BRANCH = 10;

export const SHIFT_CODES = ["morning", "evening", "night"] as const;
export type ShiftCode = (typeof SHIFT_CODES)[number];

export const SHIFT_LABELS: Record<ShiftCode, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
};

export function isShiftCode(value: string | null | undefined): value is ShiftCode {
  return value === "morning" || value === "evening" || value === "night";
}

export function parseShiftCode(value: string | null | undefined): ShiftCode {
  return isShiftCode(value) ? value : "morning";
}

/** Guess Morning / Evening / Night from the clock (Europe/Dublin by default). */
export function suggestShiftCode(now = new Date(), timeZone = "Europe/Dublin"): ShiftCode {
  const hour = hourInZone(now, timeZone);
  if (hour >= 6 && hour < 14) return "morning";
  if (hour >= 14 && hour < 22) return "evening";
  return "night";
}

/**
 * Business date for a shift. Night after midnight (00:00–05:59) belongs to
 * the previous calendar day so the evening-to-night run stays one shift.
 */
export function defaultBusinessDateISO(
  shift: ShiftCode,
  now = new Date(),
  timeZone = "Europe/Dublin",
): string {
  const date = calendarDateInZone(now, timeZone);
  const hour = hourInZone(now, timeZone);
  if (shift === "night" && hour < 6) {
    return addCalendarDays(date, -1);
  }
  return date;
}

export function nextShiftOpen(
  shift: ShiftCode,
  businessDate: string,
): {
  shift: ShiftCode;
  businessDate: string;
} {
  if (shift === "morning") return { shift: "evening", businessDate };
  if (shift === "evening") return { shift: "night", businessDate };
  return { shift: "morning", businessDate: addCalendarDays(businessDate, 1) };
}

export function formatShiftLabel(shift: string | null | undefined): string {
  return isShiftCode(shift) ? SHIFT_LABELS[shift] : "Morning";
}

export function formatTillLabel(n: number | null | undefined): string {
  if (n == null || n < 1) return "Till";
  return `Till ${n}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  const dt = new Date(utc);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hourInZone(now: Date, timeZone: string): number {
  const hourRaw = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number.parseInt(hourRaw, 10);
}

function calendarDateInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
