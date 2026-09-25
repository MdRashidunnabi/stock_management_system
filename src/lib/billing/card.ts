export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "maestro";

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  maestro: "Maestro",
};

export const DISPLAY_CARD_BRANDS: CardBrand[] = ["visa", "mastercard", "amex", "discover"];

const BRAND_LENGTHS: Record<CardBrand, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
  amex: [15],
  discover: [16],
  maestro: [12, 13, 14, 15, 16, 17, 18, 19],
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function luhnCheck(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

export function detectCardBrand(number: string): CardBrand | null {
  const d = digitsOnly(number);
  if (!d) return null;
  if (/^3[47]/.test(d)) return "amex";
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(d)) return "mastercard";
  if (/^(6011|65|64[4-9])/.test(d)) return "discover";
  if (d.startsWith("4")) return "visa";
  if (/^(50|5[6-9]|6)/.test(d)) return "maestro";
  return null;
}

export function isValidCardNumber(number: string): boolean {
  const d = digitsOnly(number);
  const brand = detectCardBrand(d);
  if (!brand) return false;
  if (!BRAND_LENGTHS[brand].includes(d.length)) return false;
  return luhnCheck(d);
}

export function cvcLengthForBrand(brand: CardBrand | null): number {
  return brand === "amex" ? 4 : 3;
}

export function isValidCvc(cvc: string, brand: CardBrand | null): boolean {
  const d = digitsOnly(cvc);
  return d.length === cvcLengthForBrand(brand) && /^\d+$/.test(d);
}

export function isExpiryInFuture(month: string, year: string, now = new Date()): boolean {
  if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^\d{2}$/.test(year)) return false;
  const expYear = 2000 + Number(year);
  const expMonth = Number(month);
  const expiresAt = new Date(expYear, expMonth, 1);
  return expiresAt > now;
}

export function formatCardNumber(number: string): string {
  const brand = detectCardBrand(number);
  const max = brand === "amex" ? 15 : 19;
  const d = digitsOnly(number).slice(0, max);
  if (brand === "amex") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatCardholderName(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 120);
}

export function isValidCardholderName(value: string): boolean {
  const name = value.trim();
  return (
    name.length >= 2 && name.length <= 120 && /[\p{L}]/u.test(name) && /^[\p{L} .'-]+$/u.test(name)
  );
}

export function formatExpiryInput(value: string): string {
  let d = digitsOnly(value).slice(0, 4);
  if (d.length === 1 && Number(d[0]) > 1) d = `0${d}`;
  if (d.length >= 2) {
    const month = Number(d.slice(0, 2));
    if (month > 12) d = `0${d[0]}${d.slice(1)}`.slice(0, 4);
  }
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)} / ${d.slice(2)}`;
}

export function parseExpiry(value: string): { month: string; year: string } | null {
  const d = digitsOnly(value);
  if (d.length !== 4) return null;
  return { month: d.slice(0, 2), year: d.slice(2) };
}

export function maskedCardNumber(number: string): string {
  const d = digitsOnly(number);
  const brand = detectCardBrand(d);
  if (!d) return brand === "amex" ? "•••• •••••• •••••" : "•••• •••• •••• ••••";
  const formatted = formatCardNumber(d);
  const lastGroup = formatted.split(" ").at(-1) ?? "";
  const keep = Math.min(lastGroup.length, 4);
  const visible = d.slice(-keep);
  if (brand === "amex") {
    return `•••• •••••• ${visible.padStart(5, "•")}`;
  }
  const groups = Math.max(1, Math.ceil(d.length / 4));
  return Array.from({ length: groups }, (_, i) =>
    i === groups - 1 ? visible.padStart(Math.min(4, d.length), "•") : "••••",
  ).join(" ");
}
