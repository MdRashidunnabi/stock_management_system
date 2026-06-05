import { describe, expect, it } from "vitest";
import { getStockDisplay } from "@/lib/storefront/stock-display";

describe("getStockDisplay", () => {
  it("marks out of stock", () => {
    const d = getStockDisplay(0);
    expect(d.variant).toBe("out");
    expect(d.canAddToCart).toBe(false);
    expect(d.label).toBe("Out of stock");
  });

  it("shows quantity when five or fewer", () => {
    expect(getStockDisplay(5).label).toBe("Only 5 left");
    expect(getStockDisplay(1).label).toBe("Only 1 left");
    expect(getStockDisplay(5).showQuantity).toBe(true);
  });

  it("shows in stock without number above threshold", () => {
    const d = getStockDisplay(6);
    expect(d.variant).toBe("in_stock");
    expect(d.label).toBe("In stock");
    expect(d.showQuantity).toBe(false);
  });
});
