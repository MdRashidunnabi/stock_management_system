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
export function earnedVoucherAmount(
  eligible: number,
  rate = VOUCHER_EARN_RATE,
  minimumSpend = 0,
): number {
  if (eligible + 1e-9 < Math.max(0, minimumSpend)) return 0;
  const raw = money2(Math.max(0, eligible) * rate);
  return raw + 1e-9 >= VOUCHER_MIN_EARN ? raw : 0;
}

/** Spend at least `from` euro to earn `amount` euro. The highest matching row wins. */
export type VoucherTier = { from: number; amount: number };

export const DEFAULT_TILL_VOUCHER_TIERS: VoucherTier[] = [
  { from: 20, amount: 1 },
  { from: 40, amount: 2 },
  { from: 50, amount: 3 },
  { from: 80, amount: 5 },
  { from: 100, amount: 7 },
];

export const DEFAULT_ONLINE_VOUCHER_TIERS: VoucherTier[] = [
  { from: 50, amount: 2 },
  { from: 80, amount: 3 },
  { from: 100, amount: 5 },
];

export function voucherAmountFromTiers(eligible: number, tiers: VoucherTier[]): number {
  const spend = Math.max(0, eligible);
  const match = [...tiers]
    .filter((tier) => tier.amount > 0 && Number.isFinite(tier.from))
    .sort((a, b) => b.from - a.from)
    .find((tier) => spend + 1e-9 >= tier.from);
  return match ? money2(match.amount) : 0;
}

export type PosVoucherSettings = {
  enabled: boolean;
  pct: number;
  days: number;
  minimum: number;
};

function token(notes: string | null | undefined, name: string): string | null {
  const match = String(notes || "").match(new RegExp(`\\[${name}=([^\\]]+)\\]`));
  return match?.[1] ?? null;
}

export function voucherMinimumFromNotes(notes: string | null | undefined): number {
  const min = Number(token(notes, "voucher_min") ?? 0);
  if (!Number.isFinite(min) || min < 0 || min > 10000) return 0;
  return Math.round(min * 100) / 100;
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
  const minimum = Number(token(notes, "pos_voucher_min") ?? 0);
  return {
    enabled: enabledRaw == null ? true : enabledRaw !== "off",
    pct: Number.isFinite(pct) ? Math.max(0, Math.min(50, pct)) : 5,
    days: Number.isFinite(days) ? Math.max(1, Math.min(365, Math.round(days))) : 30,
    minimum: Number.isFinite(minimum) ? Math.max(0, Math.min(10000, minimum)) : 0,
  };
}

export function voucherPctFromNotes(notes: string | null | undefined): number {
  return Math.round(voucherRateFromNotes(notes) * 1000) / 10;
}

function parseTierToken(raw: string | null, fallback: VoucherTier[]): VoucherTier[] {
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const from = Number((row as { from?: unknown }).from);
        const amount = Number((row as { amount?: unknown }).amount);
        if (!Number.isFinite(from) || !Number.isFinite(amount) || from < 0 || amount < 0)
          return null;
        return { from: money2(Math.min(100000, from)), amount: money2(Math.min(10000, amount)) };
      })
      .filter((row): row is VoucherTier => row != null)
      .sort((a, b) => a.from - b.from)
      .slice(0, 12);
  } catch {
    return fallback;
  }
}

export function readOnlineVoucherTiers(notes: string | null | undefined): VoucherTier[] {
  return parseTierToken(token(notes, "voucher_tiers"), DEFAULT_ONLINE_VOUCHER_TIERS);
}

export function readPosVoucherTiers(notes: string | null | undefined): VoucherTier[] {
  return parseTierToken(token(notes, "pos_voucher_tiers"), DEFAULT_TILL_VOUCHER_TIERS);
}

export function earnedFromTiers(
  eligible: number,
  notes: string | null | undefined,
  channel: "online" | "pos",
): number {
  const tiers = channel === "pos" ? readPosVoucherTiers(notes) : readOnlineVoucherTiers(notes);
  return voucherAmountFromTiers(eligible, tiers);
}

function tierToken(name: string, tiers: VoucherTier[]): string {
  const clean = tiers
    .filter((tier) => tier.from >= 0 && tier.amount >= 0)
    .slice(0, 12)
    .map((tier) => ({ from: money2(tier.from), amount: money2(tier.amount) }));
  return `[${name}=${encodeURIComponent(JSON.stringify(clean))}]`;
}

export function withVoucherSettings(
  notes: string | null | undefined,
  settings: {
    onlinePct: number;
    onlineMinimum?: number;
    pos: PosVoucherSettings;
    onlineTiers?: VoucherTier[];
    posTiers?: VoucherTier[];
  },
): string {
  let rest = String(notes || "")
    .replace(/\[voucher_pct=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher_pct=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher_days=[^\]]+\]\n?/g, "")
    .replace(/\[pos_voucher_min=[^\]]+\]\n?/g, "")
    .replace(/\[voucher_min=[^\]]+\]\n?/g, "");
  if (settings.onlineTiers) rest = rest.replace(/\[voucher_tiers=[^\]]+\]\n?/g, "");
  if (settings.posTiers) rest = rest.replace(/\[pos_voucher_tiers=[^\]]+\]\n?/g, "");
  rest = rest.trim();
  const onlinePct = Math.max(0, Math.min(50, settings.onlinePct));
  const posPct = Math.max(0, Math.min(50, settings.pos.pct));
  const days = Math.max(1, Math.min(365, Math.round(settings.pos.days)));
  const onlineMinimum = Math.max(0, Math.min(10000, settings.onlineMinimum ?? 0));
  const posMinimum = Math.max(0, Math.min(10000, settings.pos.minimum ?? 0));
  return [
    settings.onlineTiers ? tierToken("voucher_tiers", settings.onlineTiers) : "",
    settings.posTiers ? tierToken("pos_voucher_tiers", settings.posTiers) : "",
    `[voucher_pct=${onlinePct}]`,
    `[voucher_min=${onlineMinimum}]`,
    `[pos_voucher=${settings.pos.enabled ? "on" : "off"}]`,
    `[pos_voucher_pct=${posPct}]`,
    `[pos_voucher_days=${days}]`,
    `[pos_voucher_min=${posMinimum}]`,
    rest,
  ]
    .filter(Boolean)
    .join("\n");
}

export function withVoucherPct(notes: string | null | undefined, pct: number): string {
  return withVoucherSettings(notes, {
    onlinePct: pct,
    onlineMinimum: voucherMinimumFromNotes(notes),
    pos: readPosVoucherSettings(notes),
  });
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
