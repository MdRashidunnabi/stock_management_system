import { describe, expect, it } from "vitest";
import {
  dublinStartOfDay,
  getDublinOffsetMinutes,
  getPeriodRange,
  getPriorPeriodRange,
  toDublinIsoDate,
} from "@/lib/reports/period";

/**
 * Period range maths is tricky because:
 *   - The server may run in UTC; the dashboard must show "today" in IE.
 *   - DST is observed: Europe/Dublin is GMT+0 in winter, GMT+1 in summer.
 *
 * These tests pin the rules so a re-org or a Dayjs/Temporal swap can't
 * silently break the owner dashboard's date filters.
 */
describe("dublinStartOfDay", () => {
  it("returns 00:00 in Dublin (winter, GMT+0)", () => {
    // 2026-01-15 14:30 UTC is 14:30 in Dublin (no DST in Jan).
    const at = new Date("2026-01-15T14:30:00.000Z");
    const start = dublinStartOfDay(at);
    expect(start.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("returns 00:00 in Dublin (summer, GMT+1)", () => {
    // 2026-07-15 23:30 UTC is 2026-07-16 00:30 in Dublin -> "today" is the 16th.
    const at = new Date("2026-07-15T23:30:00.000Z");
    const start = dublinStartOfDay(at);
    expect(start.toISOString()).toBe("2026-07-15T23:00:00.000Z"); // 2026-07-16 00:00 IST
  });

  it("crosses the DST spring-forward boundary cleanly", () => {
    // 2026 IE DST starts on Sunday 2026-03-29. At 01:00 UTC clocks jump to 02:00.
    // For 2026-03-29 14:00 UTC we are in DST; midnight Dublin = 2026-03-28T23:00:00Z.
    const inDst = new Date("2026-03-29T14:00:00.000Z");
    expect(dublinStartOfDay(inDst).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    // For 2026-03-29 00:30 UTC we are not yet in DST; the Dublin clock reads
    // 2026-03-29 00:30, so the day's start was 2026-03-29 00:00 = 00:00 UTC.
    const beforeDst = new Date("2026-03-29T00:30:00.000Z");
    expect(dublinStartOfDay(beforeDst).toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });
});

describe("getDublinOffsetMinutes", () => {
  it("is 0 in winter (GMT)", () => {
    expect(getDublinOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(0);
  });
  it("is 60 in summer (IST/BST = GMT+1)", () => {
    expect(getDublinOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(60);
  });
});

describe("toDublinIsoDate", () => {
  it("renders the local date string for a UTC midnight", () => {
    expect(toDublinIsoDate(new Date("2026-07-15T23:30:00.000Z"))).toBe("2026-07-16");
    expect(toDublinIsoDate(new Date("2026-01-15T14:30:00.000Z"))).toBe("2026-01-15");
  });
});

describe("getPeriodRange", () => {
  const now = new Date("2026-07-15T14:00:00.000Z"); // summer = DST

  it("today: from = midnight Dublin, to = now", () => {
    const r = getPeriodRange("today", now);
    expect(r.label).toBe("Today");
    expect(r.days).toBe(1);
    expect(r.fromIso).toBe("2026-07-14T23:00:00.000Z"); // 2026-07-15 00:00 IST
    expect(r.toIso).toBe(now.toISOString());
  });

  it("week: 7-day window ending now, starting 6 days back from start-of-today", () => {
    const r = getPeriodRange("week", now);
    expect(r.label).toBe("Last 7 days");
    expect(r.days).toBe(7);
    const from = new Date(r.fromIso);
    const startOfToday = new Date("2026-07-14T23:00:00.000Z");
    const expected = new Date(startOfToday.getTime() - 6 * 86_400_000);
    expect(from.toISOString()).toBe(expected.toISOString());
  });

  it("month: 30-day window ending now, starting 29 days back from start-of-today", () => {
    const r = getPeriodRange("month", now);
    expect(r.label).toBe("Last 30 days");
    expect(r.days).toBe(30);
    const from = new Date(r.fromIso);
    const startOfToday = new Date("2026-07-14T23:00:00.000Z");
    const expected = new Date(startOfToday.getTime() - 29 * 86_400_000);
    expect(from.toISOString()).toBe(expected.toISOString());
  });
});

describe("getPriorPeriodRange", () => {
  it("mirrors the period span and ends where the period starts", () => {
    const now = new Date("2026-07-15T14:00:00Z");
    const period = getPeriodRange("week", now);
    const prior = getPriorPeriodRange(period);
    expect(prior.toIso).toBe(period.fromIso);
    expect(prior.days).toBe(period.days);
    const span = new Date(period.toIso).getTime() - new Date(period.fromIso).getTime();
    const priorSpan = new Date(prior.toIso).getTime() - new Date(prior.fromIso).getTime();
    expect(priorSpan).toBe(span);
  });

  it("singularises the label for a 1-day period", () => {
    const now = new Date("2026-01-15T14:30:00Z");
    const period = getPeriodRange("today", now);
    const prior = getPriorPeriodRange(period);
    expect(prior.label).toBe("Prior 1 day");
  });
});
