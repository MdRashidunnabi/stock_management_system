/** Common banknotes a cashier can tap instead of typing. */
const NOTES_BY_CURRENCY: Record<string, number[]> = {
  EUR: [5, 10, 20, 50, 100, 200],
  GBP: [5, 10, 20, 50],
  USD: [1, 5, 10, 20, 50, 100],
  CHF: [10, 20, 50, 100, 200],
  SEK: [20, 50, 100, 200, 500],
  NOK: [50, 100, 200, 500],
  DKK: [50, 100, 200, 500],
  PLN: [10, 20, 50, 100, 200],
  CZK: [100, 200, 500, 1000],
  HUF: [500, 1000, 2000, 5000, 10000],
  RON: [5, 10, 50, 100, 200],
  BGN: [5, 10, 20, 50, 100],
  TRY: [5, 10, 20, 50, 100, 200],
  BRL: [2, 5, 10, 20, 50, 100, 200],
  MXN: [20, 50, 100, 200, 500],
  CAD: [5, 10, 20, 50, 100],
  AUD: [5, 10, 20, 50, 100],
  NZD: [5, 10, 20, 50, 100],
  JPY: [1000, 2000, 5000, 10000],
  CNY: [1, 5, 10, 20, 50, 100],
  INR: [10, 20, 50, 100, 200, 500],
  PKR: [10, 20, 50, 100, 500, 1000],
  BDT: [10, 20, 50, 100, 200, 500, 1000],
  AED: [5, 10, 20, 50, 100, 200, 500],
  SAR: [5, 10, 50, 100, 500],
  ZAR: [10, 20, 50, 100, 200],
  KES: [50, 100, 200, 500, 1000],
  NGN: [100, 200, 500, 1000],
};

export function cashNoteValues(currency = "EUR"): number[] {
  const code = currency.trim().toUpperCase();
  return NOTES_BY_CURRENCY[code] ?? NOTES_BY_CURRENCY.EUR!;
}
