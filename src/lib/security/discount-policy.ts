import { round2 } from "@/lib/pos/totals";
import type { AppRole } from "@/lib/auth/tenant";

/** Cashier / warehouse / delivery may discount up to this fraction of the line. */
export const CASHIER_MAX_LINE_DISCOUNT_RATE = 0.2;

const UNLIMITED_DISCOUNT_ROLES = new Set<AppRole>([
  "owner",
  "manager",
  "accountant",
  "support_admin",
  "super_admin",
]);

export function maxAllowedLineDiscount(role: AppRole, lineGross: number): number {
  const gross = Math.max(0, lineGross);
  if (UNLIMITED_DISCOUNT_ROLES.has(role)) return round2(gross);
  return round2(gross * CASHIER_MAX_LINE_DISCOUNT_RATE);
}

export function assertLineDiscountAllowed(input: {
  role: AppRole;
  qty: number;
  unitPrice: number;
  discount: number;
}): { ok: true } | { ok: false; error: string } {
  const discount = Number(input.discount) || 0;
  if (discount <= 0) return { ok: true };
  if (!Number.isFinite(discount) || discount < 0) {
    return { ok: false, error: "Invalid discount." };
  }
  const lineGross = round2(input.qty * input.unitPrice);
  if (discount > lineGross + 0.009) {
    return { ok: false, error: "Discount cannot exceed the line total." };
  }
  const max = maxAllowedLineDiscount(input.role, lineGross);
  if (discount > max + 0.009) {
    return {
      ok: false,
      error: "This discount needs a manager. Cashiers may take off up to 20% per line.",
    };
  }
  return { ok: true };
}
