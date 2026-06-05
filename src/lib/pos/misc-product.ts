import type { CartLine } from "@/lib/pos/schemas";

/** Catch-all catalogue SKU for one-off POS sales (see db/needscarlow-misc-product.ts). */
export const POS_MISC_SKU = "NC-MISC-0001";
export const POS_MISC_SEARCH = "MISC";

export function isPosMiscLine(line: Pick<CartLine, "sku">): boolean {
  return line.sku === POS_MISC_SKU;
}

/** Map cart line to commit payload; misc lines send custom unit_price to the server. */
export function cartLineToCommitItem(line: CartLine): {
  productId: string;
  qty: number;
  discount: number;
  unitPrice?: number;
} {
  return {
    productId: line.productId,
    qty: line.qty,
    discount: line.discount || 0,
    ...(isPosMiscLine(line) ? { unitPrice: line.unitPrice } : {}),
  };
}
