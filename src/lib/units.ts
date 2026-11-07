/** A pack size such as "10kg" or "6x330ml". Stock counts packs, not kilos or litres. */
export function isPackSize(unit: string | null | undefined): boolean {
  return /^\d/.test((unit ?? "").trim());
}

/** The unit without the amount, for unit columns: "2kg" → "kg", "5x80g" → "g", "5pcs" → "pcs". */
export function unitKind(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return u.replace(/^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?/i, "") || u;
}

/** Text after a quantity: "5 × 10kg" for packs, "2.5 kg" for weighed goods. */
export function qtyUnitLabel(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return isPackSize(u) ? `× ${u}` : u;
}

/** Shown to shoppers beside the price. Nothing for plain "each" items or when the name has the size. */
export function shopUnitLabel(unit: string | null | undefined, name?: string): string | null {
  const u = (unit ?? "").trim();
  if (!u || ["un", "ea", "each"].includes(u.toLowerCase())) return null;
  if (!isPackSize(u)) return `per ${u}`;
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  return name && squash(name).includes(squash(u)) ? null : u;
}
