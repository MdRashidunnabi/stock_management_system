/**
 * Pure helpers for computing report periods in Europe/Dublin local time.
 *
 * Extracted from `queries.ts` (which is server-only because it talks to
 * Supabase) so these functions can be unit-tested under jsdom or Node
 * without dragging in `server-only`.
 */

export type ReportPeriod = "today" | "week" | "month";

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
export function dublinStartOfDay(date: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "00";
  const dublinDate = `${get("year")}-${get("month")}-${get("day")}`;
  const utcMidnight = new Date(`${dublinDate}T00:00:00Z`);
  const offsetMin = getDublinOffsetMinutes(utcMidnight);
  return new Date(utcMidnight.getTime() - offsetMin * 60_000);
}

export function getDublinOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
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

export function toDublinIsoDate(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getPeriodRange(period: ReportPeriod, now: Date = new Date()): PeriodRange {
  const startOfToday = dublinStartOfDay(now);
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
