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

/** 5% of eligible spend, rounded to the cent. */
export function earnedVoucherAmount(eligible: number): number {
  const raw = money2(Math.max(0, eligible) * VOUCHER_EARN_RATE);
  return raw + 1e-9 >= VOUCHER_MIN_EARN ? raw : 0;
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
