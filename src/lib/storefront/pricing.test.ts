import { describe, expect, it } from "vitest";
import { computeOnlinePriceDisplay } from "@/lib/storefront/pricing";

describe("computeOnlinePriceDisplay", () => {
  it("applies default markup when no manual online price", () => {
    const d = computeOnlinePriceDisplay({
      sellingPrice: 100,
      onlineSellingPrice: null,
      onlineDiscountPct: null,
      markupPct: 0.5,
    });
    expect(d.price).toBe(100.5);
    expect(d.compareAtPrice).toBeNull();
  });

  it("treats manual online price of 0 as auto markup (empty field)", () => {
    const d = computeOnlinePriceDisplay({
      sellingPrice: 2.49,
      onlineSellingPrice: 0,
      onlineDiscountPct: 50,
      markupPct: 1,
    });
    expect(d.baseOnlinePrice).toBe(2.51);
    expect(d.compareAtPrice).toBe(2.51);
    expect(d.price).toBe(1.25);
    expect(d.discountPct).toBe(50);
  });

  it("applies discount with strikethrough base", () => {
    const d = computeOnlinePriceDisplay({
      sellingPrice: 10,
      onlineSellingPrice: 20,
      onlineDiscountPct: 10,
      markupPct: 0,
    });
    expect(d.compareAtPrice).toBe(20);
    expect(d.price).toBe(18);
    expect(d.discountPct).toBe(10);
  });
});
