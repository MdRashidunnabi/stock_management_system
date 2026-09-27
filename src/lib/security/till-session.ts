import type { AppRole } from "@/lib/auth/tenant";

const CAN_SELL_ON_ANOTHER_TILL = new Set<AppRole>([
  "owner",
  "manager",
  "accountant",
  "support_admin",
  "super_admin",
]);

/** Cashiers keep one drawer. Supervisors may open another till on a different computer. */
export function canOpenSecondTillOnAnotherComputer(role: AppRole): boolean {
  return CAN_SELL_ON_ANOTHER_TILL.has(role);
}

export function canAttachSaleToTill(input: {
  role: AppRole;
  userId: string;
  sessionCashierId: string;
  sessionStatus: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.sessionStatus !== "open") {
    return { ok: false, error: "This till is not open." };
  }
  if (input.sessionCashierId === input.userId) return { ok: true };
  if (CAN_SELL_ON_ANOTHER_TILL.has(input.role)) return { ok: true };
  return { ok: false, error: "This till belongs to another cashier." };
}
