import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  defaultBusinessDateISO,
  formatTillLabel,
  nextShiftOpen,
  parseShiftCode,
  suggestShiftCode,
} from "@/lib/pos/shifts";

describe("shifts", () => {
  it("parses only morning, evening, night", () => {
    expect(parseShiftCode("evening")).toBe("evening");
    expect(parseShiftCode("nope")).toBe("morning");
  });

  it("suggests evening in the afternoon Dublin time", () => {
    const afternoon = new Date("2026-09-24T16:00:00+01:00");
    expect(suggestShiftCode(afternoon, "Europe/Dublin")).toBe("evening");
  });

  it("puts a 1am night shift on the previous calendar day", () => {
    const afterMidnight = new Date("2026-09-25T01:30:00+01:00");
    expect(defaultBusinessDateISO("night", afterMidnight, "Europe/Dublin")).toBe("2026-09-24");
    expect(defaultBusinessDateISO("morning", afterMidnight, "Europe/Dublin")).toBe("2026-09-25");
  });

  it("opens the next shift on the same day, then morning the next day after night", () => {
    expect(nextShiftOpen("morning", "2026-09-24")).toEqual({
      shift: "evening",
      businessDate: "2026-09-24",
    });
    expect(nextShiftOpen("night", "2026-09-24")).toEqual({
      shift: "morning",
      businessDate: "2026-09-25",
    });
  });

  it("adds calendar days without timezone drift", () => {
    expect(addCalendarDays("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("labels tills as Till 1 … Till 10", () => {
    expect(formatTillLabel(3)).toBe("Till 3");
    expect(formatTillLabel(null)).toBe("Till");
  });
});
