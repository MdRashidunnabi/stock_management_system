import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  value: number,
  currency = "EUR",
  locale = "en",
  options?: Intl.NumberFormatOptions,
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value);
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

/** ShopOS subscription billing stays in euro. Tenant till money uses formatMoney. */
export function formatEuro(value: number, options?: Intl.NumberFormatOptions) {
  return formatMoney(value, "EUR", "en", options);
}

export function formatDateTime(date: Date | string | number, timeZone = "UTC", locale = "en") {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(typeof date === "string" || typeof date === "number" ? new Date(date) : date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(typeof date === "string" || typeof date === "number" ? new Date(date) : date);
  }
}

/** @deprecated Use formatDateTime with the shop timezone. */
export function formatDateTimeIE(date: Date | string | number) {
  return formatDateTime(date, "Europe/Dublin", "en-IE");
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
