import catalog from "@/lib/storefront/counter-catalog.json";

export type CutOption = {
  id: string;
  label: string;
  hint: string;
};

export const CUT_GROUPS: Record<string, CutOption[]> = {
  fish: [
    { id: "whole-clean", label: "Whole, cleaned", hint: "Scaled and gutted. Head on." },
    { id: "headed-gutted", label: "Headed & gutted", hint: "Ready to cook whole." },
    { id: "steaks", label: "Steaks", hint: "Cut across the bone." },
    { id: "fillet-on", label: "Fillets, skin on", hint: "Boneless. Skin stays on." },
    { id: "fillet-off", label: "Fillets, skin off", hint: "Boneless. No skin." },
    { id: "pieces", label: "Cut into pieces", hint: "For curry, stew or fry." },
    { id: "sliced", label: "Sliced for frying", hint: "Thin slices." },
    { id: "as-is", label: "Whole, as it is", hint: "No cleaning." },
  ],
  prawn: [
    { id: "shell-on", label: "Shell on", hint: "Whole prawns." },
    { id: "headless", label: "Headless, shell on", hint: "Heads removed." },
    { id: "peeled", label: "Peeled & cleaned", hint: "Ready to cook." },
    { id: "butterfly", label: "Butterflied", hint: "Opened for frying." },
  ],
  squid: [
    { id: "whole-clean", label: "Whole, cleaned", hint: "Gutted. Tubes and tentacles." },
    { id: "rings", label: "Cut into rings", hint: "For frying." },
    { id: "tubes", label: "Tubes only", hint: "Cleaned tubes." },
    { id: "as-is", label: "As it is", hint: "No cleaning." },
  ],
  chicken: [
    { id: "whole", label: "Whole bird", hint: "Leave it whole." },
    { id: "pieces", label: "Cut into 8 pieces", hint: "Classic roast cut." },
    { id: "curry", label: "Curry cut", hint: "Smaller pieces, bone in." },
    { id: "boneless", label: "Boneless pieces", hint: "Meat off the bone." },
    { id: "skinless", label: "Skinless pieces", hint: "Skin and extra fat off." },
  ],
  "chicken-part": [
    { id: "as-is", label: "As it is", hint: "No extra cutting." },
    { id: "cubes", label: "Cubed", hint: "For curry or kebab." },
    { id: "sliced", label: "Sliced", hint: "Thin slices." },
    { id: "mince", label: "Mince this", hint: "We mince it for you." },
  ],
  lamb: [
    { id: "chops", label: "Chops", hint: "Cut into chops." },
    { id: "curry", label: "Curry cut", hint: "Bone in, small pieces." },
    { id: "cubes", label: "Boneless cubes", hint: "For curry or kebab." },
    { id: "mince", label: "Mince", hint: "We mince it for you." },
    { id: "as-is", label: "As it is", hint: "No extra cutting." },
  ],
  beef: [
    { id: "curry", label: "Curry cut", hint: "Small pieces, bone in." },
    { id: "cubes", label: "Boneless cubes", hint: "Stew or curry." },
    { id: "strips", label: "Strips", hint: "For stir fry." },
    { id: "mince", label: "Mince", hint: "We mince it for you." },
    { id: "as-is", label: "As it is", hint: "No extra cutting." },
  ],
  goat: [
    { id: "curry", label: "Curry cut", hint: "Bone in, small pieces." },
    { id: "cubes", label: "Boneless cubes", hint: "For curry." },
    { id: "mince", label: "Mince", hint: "We mince it for you." },
    { id: "as-is", label: "As it is", hint: "No extra cutting." },
  ],
  mince: [
    { id: "standard", label: "Standard mince", hint: "Ready to cook." },
    { id: "fine", label: "Fine mince", hint: "Finer grind." },
  ],
};

export const WEIGHTS_KG = [0.5, 0.75, 1, 1.5, 2] as const;

/** Whole fish is priced after it is weighed. The amount on screen is an estimate. */
export function isWholeFishCut(label: string | null | undefined): boolean {
  return /^\s*whole\b/i.test(label || "");
}

type CounterRow = { k?: string; s?: string; c?: string };

export function counterForCode(code: string | null | undefined): CounterRow | null {
  const key = String(code || "").trim();
  if (!key) return null;
  const row = (catalog as Record<string, CounterRow>)[key];
  return row ?? null;
}

export function isCounterProduct(
  barcode: string | null | undefined,
  sku: string | null | undefined,
) {
  return Boolean(counterForCode(barcode) || counterForCode(sku));
}

export function cutsForCode(
  barcode: string | null | undefined,
  sku: string | null | undefined,
): CutOption[] {
  const row = counterForCode(barcode) || counterForCode(sku);
  if (!row?.c) return [];
  return CUT_GROUPS[row.c] ?? [];
}

export function lineIdFor(productId: string, cutId?: string) {
  return cutId ? `${productId}::${cutId}` : productId;
}

export function counterLineName(productName: string, cutLabel?: string, kg?: number) {
  const bits = [productName];
  if (cutLabel) bits.push(cutLabel);
  if (kg) bits.push(`${kg} kg`);
  return bits.join(" · ");
}
