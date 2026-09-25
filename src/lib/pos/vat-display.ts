/** Irish VAT rates often need one decimal (13.5%, 4.8%); 23% stays whole. */
export function formatVatPercent(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.round(pct * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}
