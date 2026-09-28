/**
 * Pure helpers for computing report periods in Europe/Dublin local time.
 *
 * Extracted from `queries.ts` (which is server-only because it talks to
 * Supabase) so these functions can be unit-tested under jsdom or Node
 * without dragging in `server-only`.
 */

export type ReportPeriod = "today" | "week" | "month";
export type ReportChannel = "all" | "pos" | "online";

export const MIN_ADVANCE_DAYS = 3;

export interface PeriodRange {
  /** ISO timestamp at the start of the period (Europe/Dublin), inclusive. */
  fromIso: string;
  /** ISO timestamp at the end of the period (Europe/Dublin), exclusive. */
  toIso: string;
  /** Human-readable label for the period. */
  label: string;
  /** Number of full days the period spans (used for delta % vs prior period). */
  days: number;
}

const TIMEZONE = "Europe/Dublin";

/**
 * Compute midnight in Dublin local time as a UTC instant.
 * Handles DST: IE switches between IST/BST and GMT in March / October.
 */
export function dublinStartOfDay(date: Date, timeZone = TIMEZONE): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "00";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  const utcMidnight = new Date(`${localDate}T00:00:00Z`);
  const offsetMin = getOffsetMinutes(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offsetMin * 60_000);
}

export function getDublinOffsetMinutes(at: Date): number {
  return getOffsetMinutes(at, TIMEZONE);
}

export function getOffsetMinutes(at: Date, timeZone = TIMEZONE): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const tzPart = dtf.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  if (!tzPart) return 0;
  const m = tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const hours = Number(m[1]);
  const minutes = Number(m[2] ?? 0);
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

export function toDublinIsoDate(date: Date, timeZone = TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getPeriodRange(
  period: ReportPeriod,
  now: Date = new Date(),
  timeZone = TIMEZONE,
): PeriodRange {
  const startOfToday = dublinStartOfDay(now, timeZone);
  if (period === "today") {
    return {
      fromIso: startOfToday.toISOString(),
      toIso: now.toISOString(),
      label: "Today",
      days: 1,
    };
  }
  if (period === "week") {
    const start = new Date(startOfToday.getTime() - 6 * 86_400_000);
    return {
      fromIso: start.toISOString(),
      toIso: now.toISOString(),
      label: "Last 7 days",
      days: 7,
    };
  }
  const start = new Date(startOfToday.getTime() - 29 * 86_400_000);
  return {
    fromIso: start.toISOString(),
    toIso: now.toISOString(),
    label: "Last 30 days",
    days: 30,
  };
}

export function getPriorPeriodRange(period: PeriodRange): PeriodRange {
  const fromMs = new Date(period.fromIso).getTime();
  const toMs = new Date(period.toIso).getTime();
  const span = toMs - fromMs;
  return {
    fromIso: new Date(fromMs - span).toISOString(),
    toIso: period.fromIso,
    label: `Prior ${period.days} day${period.days === 1 ? "" : "s"}`,
    days: period.days,
  };
}

/** Inclusive calendar dates in the shop timezone (YYYY-MM-DD). */
export function getCustomDateRange(
  fromYmd: string,
  toYmd: string,
  now: Date = new Date(),
  timeZone = TIMEZONE,
): PeriodRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return null;
  const from = dublinStartOfDay(new Date(`${fromYmd}T12:00:00Z`), timeZone);
  const toStart = dublinStartOfDay(new Date(`${toYmd}T12:00:00Z`), timeZone);
  const toExclusive = new Date(toStart.getTime() + 86_400_000);
  if (toExclusive.getTime() <= from.getTime()) return null;
  const days = Math.max(1, Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000));
  const end = toExclusive.getTime() > now.getTime() ? now : toExclusive;
  return {
    fromIso: from.toISOString(),
    toIso: end.toISOString(),
    label: fromYmd === toYmd ? fromYmd : `${fromYmd} – ${toYmd}`,
    days,
  };
}

export function addCalendarDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function minAdvanceDateYmd(now: Date = new Date(), timeZone = TIMEZONE): string {
  return addCalendarDaysYmd(toDublinIsoDate(now, timeZone), MIN_ADVANCE_DAYS);
}
