/**
 * Kick the physical cash drawer.
 *
 * Today this talks to the ShopOS desktop app when present. Hardware wiring
 * (ESC/POS drawer pulse on the receipt printer) is added when the till PC
 * is connected — the POS already calls this at the right moment (cash taken).
 */
export function kickCashDrawer(): void {
  if (typeof window === "undefined") return;
  try {
    void window.shopOSDesktop?.openCashDrawer?.();
  } catch {
    // Hardware not connected yet — sale still records.
  }
}
