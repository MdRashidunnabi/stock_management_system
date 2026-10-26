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

export interface DeliveryArea {
  id: string;
  name: string;
  minOrder: number;
  fee: number;
  leadDays: number;
  times: string;
}

export const DEFAULT_DELIVERY_AREAS: DeliveryArea[] = [
  {
    id: "carlow-5km",
    name: "Carlow town, within 5 km",
    minOrder: 20,
    fee: 3.99,
    leadDays: 0,
    times: "Same day",
  },
  {
    id: "outside-carlow",
    name: "Outside Carlow town",
    minOrder: 50,
    fee: 5.99,
    leadDays: 1,
    times: "Next day",
  },
];

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeDeliveryAreas(value: unknown): DeliveryArea[] {
  if (!Array.isArray(value)) return [];
  const areas: DeliveryArea[] = [];
  value.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const name = String(record.name ?? "")
      .trim()
      .slice(0, 80);
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    const id =
      String(record.id ?? "")
        .trim()
        .slice(0, 40) ||
      slug ||
      `area-${index + 1}`;
    areas.push({
      id,
      name,
      minOrder: round2(clampNumber(Number(record.minOrder), 0, 9999)),
      fee: round2(clampNumber(Number(record.fee), 0, 99.99)),
      leadDays: Math.round(clampNumber(Number(record.leadDays), 0, 30)),
      times: String(record.times ?? "")
        .trim()
        .slice(0, 160),
    });
  });
  return areas.slice(0, 12);
}

export function deliveryAreasFromNotes(notes: string | null | undefined): DeliveryArea[] {
  const match = String(notes || "").match(/\[delivery_areas=([^\]]+)\]/);
  if (!match?.[1]) return DEFAULT_DELIVERY_AREAS;
  try {
    const areas = normalizeDeliveryAreas(JSON.parse(decodeURIComponent(match[1])));
    return areas.length > 0 ? areas : DEFAULT_DELIVERY_AREAS;
  } catch {
    return DEFAULT_DELIVERY_AREAS;
  }
}

export function withDeliveryAreas(notes: string | null | undefined, areas: DeliveryArea[]): string {
  const rest = String(notes || "")
    .replace(/\[delivery_areas=[^\]]+\]\n?/g, "")
    .trim();
  const clean = normalizeDeliveryAreas(areas);
  const token = `[delivery_areas=${encodeURIComponent(JSON.stringify(clean))}]`;
  return [token, rest].filter(Boolean).join("\n");
}

export function quoteDeliveryArea(
  productsSubtotalGross: number,
  fulfillment: FulfillmentType,
  area: DeliveryArea,
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
  const fee = round2(Math.max(0, area.fee));
  const when = [area.times, area.leadDays > 0 ? `${area.leadDays} day lead time` : "Same day"]
    .filter(Boolean)
    .join(" · ");
  return {
    fee,
    productsSubtotal: subtotal,
    isFreeDelivery: fee === 0,
    label: `${area.name}: €${fee.toFixed(2)} delivery. Minimum €${area.minOrder.toFixed(2)}. ${when}`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
