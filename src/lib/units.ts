/** A pack size such as "10kg" or "6x330ml". Stock counts packs, not kilos or litres. */
export function isPackSize(unit: string | null | undefined): boolean {
  return /^\d/.test((unit ?? "").trim());
}

/** Text after a quantity: "5 × 10kg" for packs, "2.5 kg" for weighed goods. */
export function qtyUnitLabel(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return isPackSize(u) ? `× ${u}` : u;
}

/** Shown to shoppers beside the price. Nothing for plain "each" items. */
export function shopUnitLabel(unit: string | null | undefined): string | null {
  const u = (unit ?? "").trim();
  if (!u || ["un", "ea", "each"].includes(u.toLowerCase())) return null;
  return isPackSize(u) ? u : `per ${u}`;
}
