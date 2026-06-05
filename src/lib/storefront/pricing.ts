/** Online shop price display (does not affect POS). */

export interface OnlinePriceInput {
  sellingPrice: number;
  onlineSellingPrice: number | null;
  onlineDiscountPct: number | null;
  markupPct: number;
}

export interface OnlinePriceDisplay {
  /** Price the customer pays (after discount). */
  price: number;
  /** Strikethrough price when a discount is active. */
  compareAtPrice: number | null;
  /** Badge label e.g. 10 when 10% off. */
  discountPct: number | null;
  /** Base online price before discount (auto or manual). */
  baseOnlinePrice: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampDiscount(pct: number | null | undefined): number {
  if (pct == null || !Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

function resolveManualOnlinePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function computeOnlineBasePrice(input: OnlinePriceInput): number {
  const selling = Math.max(0, input.sellingPrice);
  const manual = resolveManualOnlinePrice(input.onlineSellingPrice);
  if (manual != null) {
    return round2(manual);
  }
  const markup = Math.max(0, input.markupPct ?? 0);
  return round2(selling * (1 + markup / 100));
}

export function computeOnlinePriceDisplay(input: OnlinePriceInput): OnlinePriceDisplay {
  const base = computeOnlineBasePrice(input);
  const discount = clampDiscount(input.onlineDiscountPct);
  const price = round2(base * (1 - discount / 100));

  return {
    price,
    baseOnlinePrice: base,
    compareAtPrice: discount > 0 ? base : null,
    discountPct: discount > 0 ? Math.round(discount) : null,
  };
}
