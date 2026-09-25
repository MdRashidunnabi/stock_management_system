/**
 * Pure cart-totals math for the POS.
 *
 * Lives in its own module so the same function powers both:
 *   - the on-screen subtotal/VAT/total display in `PosTerminal`, and
 *   - the unit tests that lock in our Irish VAT rounding rules.
 *
 * The server independently recomputes totals when committing the sale
 * (see `commit_pos_sale` SQL RPC). This client-side maths only drives
 * the UI; it must agree with the server to avoid surprising the cashier.
 */

import type { CartLine } from "@/lib/pos/schemas";
import { DEFAULT_VAT_RATES, vatRateMap, type VatRates } from "@/lib/geo/countries";

/**
 * Default VAT bands (Ireland). Used when a shop's country rates are not passed,
 * so existing tests and receipts stay consistent.
 */
export const VAT_RATES: Record<string, number> = vatRateMap(DEFAULT_VAT_RATES);

export interface CartTotals {
  subtotal: number; // Net (ex-VAT)
  vat: number;
  total: number; // Gross (inc-VAT, post-discount)
  discount: number;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute totals for a cart of lines.
 *
 * Each line's price can be VAT-inclusive (typical for retail
 * shelf prices) or VAT-exclusive. Discounts are applied before VAT is
 * derived, so the line matches what the server recomputes on the receipt.
 */
export function computeCartTotals(
  cart: CartLine[],
  rates: Record<string, number> | VatRates = VAT_RATES,
): CartTotals {
  let subtotal = 0;
  let vat = 0;
  let total = 0;
  let discount = 0;

  for (const line of cart) {
    const rate = (rates as Record<string, number>)[line.vatCode] ?? 0;
    const grossBase = line.unitPrice * line.qty;

    let lineGross: number;
    let lineNet: number;
    let lineVat: number;

    if (line.vatIncluded) {
      lineGross = round4(grossBase) - line.discount;
      lineNet = round4(lineGross / (1 + rate));
      lineVat = round4(lineGross - lineNet);
    } else {
      lineNet = round4(grossBase) - line.discount;
      lineVat = round4(lineNet * rate);
      lineGross = round4(lineNet + lineVat);
    }

    subtotal += lineNet;
    vat += lineVat;
    total += lineGross;
    discount += line.discount;
  }

  return {
    subtotal: round2(subtotal),
    vat: round2(vat),
    total: round2(total),
    discount: round2(discount),
  };
}
