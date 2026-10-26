import { describe, expect, it } from "vitest";
import {
  accessUntilFromNotes,
  accessUntilHasEnded,
  withAccessUntil,
} from "@/lib/billing/access-until";

describe("access until", () => {
  it("keeps other notes when the end date changes", () => {
    const next = withAccessUntil("[voucher_pct=5]\nhello", "2026-12-31");
    expect(accessUntilFromNotes(next)).toBe("2026-12-31");
    expect(next).toContain("[voucher_pct=5]");
    expect(next).toContain("hello");
    expect(accessUntilFromNotes(withAccessUntil(next, null))).toBeNull();
  });

  it("allows the chosen day and stops the next Dublin day", () => {
    expect(accessUntilHasEnded("2026-10-23", new Date("2026-10-23T12:00:00Z"))).toBe(false);
    expect(accessUntilHasEnded("2026-10-23", new Date("2026-10-24T12:00:00Z"))).toBe(true);
  });
});
