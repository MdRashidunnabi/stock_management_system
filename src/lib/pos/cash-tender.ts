import { round2 } from "@/lib/pos/totals";

export type CashTender = {
  due: number;
  given: number;
  change: number;
  short: number;
  enough: boolean;
};

/** How much to give back when the customer tenders a note (or several). */
export function evaluateCashTender(due: number, given: number): CashTender {
  const d = round2(Math.max(0, Number(due) || 0));
  const g = round2(Math.max(0, Number(given) || 0));
  const enough = g + 0.005 >= d;
  return {
    due: d,
    given: g,
    change: enough ? round2(g - d) : 0,
    short: enough ? 0 : round2(d - g),
    enough,
  };
}

/**
 * Keypad buffer for a busy till. Digits and one decimal point; max 2 dp.
 * Empty string means 0.
 */
export function appendCashKey(current: string, key: string): string {
  if (key === "clear") return "";
  if (key === "back") {
    return current.slice(0, -1);
  }
  if (key === ".") {
    if (!current) return "0.";
    if (current.includes(".")) return current;
    return `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  if (!current || current === "0") return key;
  const parts = current.split(".");
  if (parts[1] !== undefined && parts[1].length >= 2) return current;
  if (parts[0] && parts[0].length >= 7 && !current.includes(".")) return current;
  return `${current}${key}`;
}

export function parseCashBuffer(buffer: string): number {
  if (!buffer || buffer === ".") return 0;
  const n = Number(buffer);
  if (!Number.isFinite(n) || n < 0) return 0;
  return round2(n);
}
