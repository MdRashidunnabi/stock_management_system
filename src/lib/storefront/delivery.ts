export type FulfillmentType = "delivery" | "takeaway";

export interface DeliverySettings {
  standardFee: number;
  freeOver: number;
  minOrder: number;
}

export interface DeliveryQuote {
  fee: number;
  productsSubtotal: number;
  isFreeDelivery: boolean;
  /** Human-readable line for checkout UI */
  label: string;
}

/**
 * Irish grocery-style delivery fee (similar to Tesco/Dunnes/local shops):
 * - Takeaway / collection: no delivery charge
 * - Delivery: flat fee (default €4.99) unless order subtotal ≥ free-over threshold (default €50)
 */
export function calculateDeliveryQuote(
  productsSubtotalGross: number,
  fulfillment: FulfillmentType,
  settings: DeliverySettings,
): DeliveryQuote {
  const subtotal = Math.max(0, round2(productsSubtotalGross));

  if (fulfillment === "takeaway") {
    return {
      fee: 0,
      productsSubtotal: subtotal,
      isFreeDelivery: true,
      label: "No delivery charge (collection)",
    };
  }

  const freeOver = Math.max(0, settings.freeOver);
  const standardFee = Math.max(0, settings.standardFee);

  if (subtotal >= freeOver) {
    return {
      fee: 0,
      productsSubtotal: subtotal,
      isFreeDelivery: true,
      label: `Free delivery on orders over €${freeOver.toFixed(2)}`,
    };
  }

  return {
    fee: standardFee,
    productsSubtotal: subtotal,
    isFreeDelivery: false,
    label:
      subtotal > 0
        ? `€${standardFee.toFixed(2)} delivery (free over €${freeOver.toFixed(2)})`
        : `€${standardFee.toFixed(2)} delivery`,
  };
}

export function calculateOrderTotal(productsSubtotalGross: number, deliveryFee: number): number {
  return round2(productsSubtotalGross + deliveryFee);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
