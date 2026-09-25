import { describe, expect, it } from "vitest";
import { formatVatPercent } from "@/lib/pos/vat-display";

describe("formatVatPercent", () => {
  it("prints standard 23% without a decimal", () => {
    expect(formatVatPercent(0.23)).toBe("23%");
  });

  it("keeps reduced 13.5% and livestock 4.8%", () => {
    expect(formatVatPercent(0.135)).toBe("13.5%");
    expect(formatVatPercent(0.048)).toBe("4.8%");
  });
});
