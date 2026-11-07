import { describe, expect, it } from "vitest";
import { STOCK_POOL_VALUE, isStockPool, stockLink, stockLinkValue } from "./stock-link";

const BEEF = "00000000-0000-0000-0000-0000000000be";

describe("stockLink", () => {
  it("reads the purchase product a cut sells from", () => {
    expect(stockLink(stockLinkValue(BEEF))).toEqual({ from: BEEF, factor: 1 });
    expect(stockLink([{ stock_from: BEEF, factor: 0.5 }])).toEqual({ from: BEEF, factor: 0.5 });
  });

  it("ignores ordinary products and bad factors", () => {
    expect(stockLink([])).toBeNull();
    expect(stockLink(null)).toBeNull();
    expect(stockLink([{ unit: "box", factor: 24 }])).toBeNull();
    expect(stockLink(STOCK_POOL_VALUE)).toBeNull();
    expect(stockLink([{ stock_from: BEEF, factor: -2 }])).toEqual({ from: BEEF, factor: 1 });
  });

  it("marks the purchase product itself", () => {
    expect(isStockPool(STOCK_POOL_VALUE)).toBe(true);
    expect(isStockPool(stockLinkValue(BEEF))).toBe(false);
    expect(isStockPool([])).toBe(false);
  });
});
