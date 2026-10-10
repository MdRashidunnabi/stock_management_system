/** Loyalty voucher rules for Needs online orders. */

export const VOUCHER_EARN_RATE = 0.05;
export const VOUCHER_VALID_DAYS = 30;
export const VOUCHER_MIN_EARN = 0.01;

export function money2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A voucher can reduce the product total only. Delivery is never discounted. */
export function voucherDiscount(voucherAmount: number, productsSubtotal: number): number {
  const amount = Math.max(0, voucherAmount);
  const products = Math.max(0, productsSubtotal);
  return money2(Math.min(amount, products));
}

/** The next voucher is calculated on this figure: products minus the voucher used. */
export function eligibleSpend(productsSubtotal: number, discount: number): number {
  return money2(Math.max(0, productsSubtotal - discount));
}

/** Percentage of eligible spend, rounded to the cent. Rate is 0.05 for 5%. */
export function earnedVoucherAmount(eligible: number, rate = VOUCHER_EARN_RATE): number {
  const raw = money2(Math.max(0, eligible) * rate);
  return raw + 1e-9 >= VOUCHER_MIN_EARN ? raw : 0;
}

export function voucherRateFromNotes(notes: string | null | undefined): number {
  const match = String(notes || "").match(/\[voucher_pct=(\d+(?:\.\d+)?)\]/);
  const pct = match ? Number(match[1]) : 5;
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return VOUCHER_EARN_RATE;
  return pct / 100;
}

export function voucherPctFromNotes(notes: string | null | undefined): number {
  return Math.round(voucherRateFromNotes(notes) * 1000) / 10;
}

export function withVoucherPct(notes: string | null | undefined, pct: number): string {
  const safe = Math.max(0, Math.min(50, pct));
  const rest = String(notes || "")
    .replace(/\[voucher_pct=\d+(?:\.\d+)?\]\n?/, "")
    .trim();
  return [`[voucher_pct=${safe}]`, rest].filter(Boolean).join("\n");
}

export function voucherDeadline(from = new Date(), days = VOUCHER_VALID_DAYS): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function orderTotalAfterVoucher(
  productsSubtotal: number,
  deliveryFee: number,
  discount: number,
): number {
  return money2(Math.max(0, productsSubtotal - discount) + Math.max(0, deliveryFee));
}
