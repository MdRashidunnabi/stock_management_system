import type { CartLine } from "@/lib/pos/schemas";

const PREFIX = "shopos:pos-cart:";

function storageKey(tenantId: string, branchId: string): string {
  return `${PREFIX}${tenantId}:${branchId}`;
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const l = value as CartLine;
  return (
    typeof l.productId === "string" &&
    typeof l.name === "string" &&
    typeof l.qty === "number" &&
    l.qty > 0 &&
    typeof l.unitPrice === "number"
  );
}

/** Restore the in-progress POS cart for this shop + branch (survives menu navigation). */
export function loadPosCart(tenantId: string, branchId: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(tenantId, branchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

export function savePosCart(tenantId: string, branchId: string, cart: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(tenantId, branchId);
    if (cart.length === 0) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify(cart));
  } catch {
    // Private mode / quota — POS still works, cart just won't persist.
  }
}

export function clearPosCart(tenantId: string, branchId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(tenantId, branchId));
  } catch {
    // ignore
  }
}
