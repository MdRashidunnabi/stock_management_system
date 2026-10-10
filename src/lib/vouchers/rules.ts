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

export type PosVoucherSettings = {
  enabled: boolean;
  pct: number;
  days: number;
};

function token(notes: string | null | undefined, name: string): string | null {
  const match = String(notes || "").match(new RegExp(`\\[${name}=([^\\]]+)\\]`));
  return match?.[1] ?? null;
}

export function voucherRateFromNotes(notes: string | null | undefined): number {
  const pct = Number(token(notes, "voucher_pct") ?? 5);
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return VOUCHER_EARN_RATE;
  return pct / 100;
}

export function readPosVoucherSettings(notes: string | null | undefined): PosVoucherSettings {
  const enabledRaw = token(notes, "pos_voucher");
  const pct = Number(token(notes, "pos_voucher_pct") ?? 5);
  const days = Number(token(notes, "pos_voucher_days") ?? 30);
  return {
    enabled: enabledRaw == null ? true : enabledRaw !== "off",
    pct: Number.isFinite(pct) ? Math.max(0, Math.min(50, pct)) : 5,
    days: Number.isFinite(days) ? Math.max(1, Math.min(365, Math.round(days))) : 30,
  };
}

export function voucherPctFromNotes(notes: string | null | undefined): number {
  return Math.round(voucherRateFromNotes(notes) * 1000) / 10;
}

export function withVoucherSettings(
  notes: string | null | undefined,
  settings: { onlinePct: number; pos: PosVoucherSettings },
): string {
  const rest = String(notes || "")
    .replace(/\[voucher_pct=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher_pct=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher_days=[^\]]+\]\n?/g, "")
    .trim();
  const onlinePct = Math.max(0, Math.min(50, settings.onlinePct));
  const posPct = Math.max(0, Math.min(50, settings.pos.pct));
  const days = Math.max(1, Math.min(365, Math.round(settings.pos.days)));
  return [
    `[voucher_pct=${onlinePct}]`,
    `[pos_voucher=${settings.pos.enabled ? "on" : "off"}]`,
    `[pos_voucher_pct=${posPct}]`,
    `[pos_voucher_days=${days}]`,
    rest,
  ]
    .filter(Boolean)
    .join("\n");
}

export function withVoucherPct(notes: string | null | undefined, pct: number): string {
  return withVoucherSettings(notes, { onlinePct: pct, pos: readPosVoucherSettings(notes) });
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
