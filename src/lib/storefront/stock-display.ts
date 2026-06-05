export type StockDisplayVariant = "in_stock" | "low" | "out";

export interface StockDisplay {
  available: number;
  canAddToCart: boolean;
  label: string;
  variant: StockDisplayVariant;
  /** Shown on product card when variant is low (e.g. "Only 3 left"). */
  showQuantity: boolean;
}

/**
 * Storefront stock labels (shared with POS stock pool).
 * - Out of stock: visible, cannot add to cart.
 * - 1..threshold: show exact quantity left.
 * - Above threshold: "In stock" (no number).
 */
export function getStockDisplay(available: number, threshold = 5): StockDisplay {
  const qty = Math.max(0, Number(available) || 0);

  if (qty <= 0) {
    return {
      available: 0,
      canAddToCart: false,
      label: "Out of stock",
      variant: "out",
      showQuantity: false,
    };
  }

  if (qty <= threshold) {
    const n = Math.floor(qty);
    return {
      available: qty,
      canAddToCart: true,
      label: n === 1 ? "Only 1 left" : `Only ${n} left`,
      variant: "low",
      showQuantity: true,
    };
  }

  return {
    available: qty,
    canAddToCart: true,
    label: "In stock",
    variant: "in_stock",
    showQuantity: false,
  };
}
