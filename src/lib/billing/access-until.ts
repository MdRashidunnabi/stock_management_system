const ACCESS_UNTIL_TOKEN = /\[access_until=(\d{4}-\d{2}-\d{2})\]/;

export function accessUntilFromNotes(notes: string | null | undefined): string | null {
  const match = String(notes || "").match(ACCESS_UNTIL_TOKEN);
  return match?.[1] ?? null;
}

export function withAccessUntil(notes: string | null | undefined, date: string | null): string {
  const rest = String(notes || "")
    .replace(/\[access_until=\d{4}-\d{2}-\d{2}\]\n?/g, "")
    .trim();
  if (!date) return rest;
  return [`[access_until=${date}]`, rest].filter(Boolean).join("\n");
}

function calendarParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function isRealCalendarDate(value: string): boolean {
  const parts = calendarParts(value);
  if (!parts) return false;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    utc.getUTCFullYear() === parts.year &&
    utc.getUTCMonth() === parts.month - 1 &&
    utc.getUTCDate() === parts.day
  );
}

/** Calendar date in Ireland, YYYY-MM-DD. */
export function dublinCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True once the Dublin calendar day is after the allowed date. That date itself still works. */
export function accessUntilHasEnded(date: string, now = new Date()): boolean {
  if (!isRealCalendarDate(date)) return false;
  return dublinCalendarDate(now) > date;
}

export function formatAccessUntilLabel(date: string): string {
  const parts = calendarParts(date);
  if (!parts || !isRealCalendarDate(date)) return date;
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}
