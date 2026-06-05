import { describe, expect, it } from "vitest";
import { cartLineToCommitItem, isPosMiscLine, POS_MISC_SKU } from "./misc-product";
import type { CartLine } from "./schemas";

const base: CartLine = {
  productId: "p1",
  name: "Milk",
  sku: "MILK",
  barcode: null,
  baseUnit: "un",
  unitPrice: 2.5,
  vatCode: "STD",
  vatIncluded: true,
  qty: 2,
  discount: 0,
};

describe("isPosMiscLine", () => {
  it("matches misc SKU only", () => {
    expect(isPosMiscLine({ sku: POS_MISC_SKU })).toBe(true);
    expect(isPosMiscLine({ sku: "OTHER" })).toBe(false);
  });
});

describe("cartLineToCommitItem", () => {
  it("includes unitPrice for misc lines", () => {
    const line: CartLine = { ...base, sku: POS_MISC_SKU, unitPrice: 42 };
    expect(cartLineToCommitItem(line)).toEqual({
      productId: "p1",
      qty: 2,
      discount: 0,
      unitPrice: 42,
    });
  });

  it("omits unitPrice for regular products", () => {
    expect(cartLineToCommitItem(base)).toEqual({
      productId: "p1",
      qty: 2,
      discount: 0,
    });
  });
});
