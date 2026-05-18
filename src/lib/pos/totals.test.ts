import { describe, expect, it } from "vitest";
import { computeCartTotals, round2, round4, VAT_RATES } from "@/lib/pos/totals";
import type { CartLine } from "@/lib/pos/schemas";

/**
 * VAT rounding sits between the cashier and Revenue.ie - if it drifts,
 * the receipt won't reconcile with the Z-report. These tests pin the
 * exact values the UI shows so any future refactor stays compatible
 * with the SQL `commit_pos_sale` recomputation.
 */
const baseLine: Omit<CartLine, "name" | "sku" | "barcode" | "baseUnit" | "productId"> = {
  unitPrice: 0,
  vatCode: "STD",
  vatIncluded: true,
  qty: 1,
  discount: 0,
};

function line(overrides: Partial<CartLine>): CartLine {
  return {
    productId: "p",
    name: "n",
    sku: null,
    barcode: null,
    baseUnit: "ea",
    ...baseLine,
    ...overrides,
  };
}

describe("computeCartTotals: Irish VAT", () => {
  it("returns zero totals for an empty cart", () => {
    expect(computeCartTotals([])).toEqual({ subtotal: 0, vat: 0, total: 0, discount: 0 });
  });

  it("VAT-INCLUSIVE STD 23% extracts the right net + VAT", () => {
    // €12.30 inc. VAT @23% -> €10.00 net + €2.30 VAT
    const t = computeCartTotals([line({ unitPrice: 12.3, vatCode: "STD", vatIncluded: true })]);
    expect(t.total).toBe(12.3);
    expect(t.subtotal).toBe(10.0);
    expect(t.vat).toBe(2.3);
    expect(t.discount).toBe(0);
  });

  it("VAT-EXCLUSIVE STD 23% adds VAT on top", () => {
    // €10.00 net @23% -> €2.30 VAT, €12.30 gross
    const t = computeCartTotals([line({ unitPrice: 10, vatCode: "STD", vatIncluded: false })]);
    expect(t.total).toBe(12.3);
    expect(t.subtotal).toBe(10.0);
    expect(t.vat).toBe(2.3);
  });

  it("zero-rated VAT (food, kids' clothing) leaves VAT at 0", () => {
    const t = computeCartTotals([line({ unitPrice: 5.0, vatCode: "ZER", vatIncluded: true })]);
    expect(t.total).toBe(5.0);
    expect(t.subtotal).toBe(5.0);
    expect(t.vat).toBe(0);
  });

  it("hospitality 9% (SEC) - lock the rate", () => {
    expect(VAT_RATES.SEC).toBe(0.09);
    // €10.90 inc. @9% -> ~€10.00 net + €0.90 VAT
    const t = computeCartTotals([line({ unitPrice: 10.9, vatCode: "SEC", vatIncluded: true })]);
    expect(t.total).toBe(10.9);
    expect(t.subtotal).toBe(10.0);
    expect(t.vat).toBe(0.9);
  });

  it("multi-line cart sums each tax bucket and totals", () => {
    // 2 x €1.50 zero-rated milk + 1 x €4.50 STD chocolate
    const t = computeCartTotals([
      line({ productId: "milk", unitPrice: 1.5, qty: 2, vatCode: "ZER", vatIncluded: true }),
      line({ productId: "choc", unitPrice: 4.5, qty: 1, vatCode: "STD", vatIncluded: true }),
    ]);
    // milk: 3.00 net (0% VAT), choc: 4.50 incl -> 3.6585 net + 0.8415 VAT
    expect(t.total).toBe(7.5);
    expect(t.vat).toBe(round2(round4(4.5 - 4.5 / 1.23))); // 0.84 (rounded to 2dp)
    expect(t.subtotal).toBe(round2(3 + round4(4.5 / 1.23)));
  });

  it("applies a flat discount before recomputing VAT (inclusive)", () => {
    // €10.00 inc. STD with €1.00 flat discount -> €9.00 inc.
    const t = computeCartTotals([
      line({ unitPrice: 10, vatCode: "STD", vatIncluded: true, discount: 1 }),
    ]);
    expect(t.total).toBe(9.0);
    expect(t.discount).toBe(1.0);
    // €9.00 inc. @23% -> ~€7.32 net + €1.68 VAT
    expect(t.subtotal).toBe(7.32);
    expect(t.vat).toBe(1.68);
  });

  it("applies a flat discount before recomputing VAT (exclusive)", () => {
    // €10.00 net STD with €1.00 flat discount -> €9.00 net + €2.07 VAT
    const t = computeCartTotals([
      line({ unitPrice: 10, vatCode: "STD", vatIncluded: false, discount: 1 }),
    ]);
    expect(t.subtotal).toBe(9.0);
    expect(t.vat).toBe(2.07);
    expect(t.total).toBe(11.07);
    expect(t.discount).toBe(1.0);
  });

  it("handles fractional quantities (deli scale)", () => {
    // 0.345 kg @ €11.95/kg, STD inclusive -> €4.12275 inc.
    const t = computeCartTotals([
      line({ unitPrice: 11.95, qty: 0.345, vatCode: "STD", vatIncluded: true }),
    ]);
    // round4 then round2 -> 4.12
    expect(t.total).toBe(4.12);
  });

  it("treats unknown VAT codes as 0% (defensive)", () => {
    const t = computeCartTotals([line({ unitPrice: 10, vatCode: "UNKNOWN", vatIncluded: true })]);
    expect(t.total).toBe(10);
    expect(t.vat).toBe(0);
    expect(t.subtotal).toBe(10);
  });
});

describe("rounding helpers", () => {
  it("round4 keeps four decimals (banker-free, half-up)", () => {
    expect(round4(0.12345)).toBe(0.1235);
    expect(round4(0.12344)).toBe(0.1234);
  });
  it("round2 keeps two decimals", () => {
    expect(round2(0.124)).toBe(0.12);
    expect(round2(0.125)).toBe(0.13);
  });
});
