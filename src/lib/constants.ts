import { DEFAULT_VAT_RATES, type VatCode as GeoVatCode } from "@/lib/geo/countries";

export const APP_NAME = "ShopOS";
export const APP_DESCRIPTION = "Retail operating system for shops in any country.";

/** Fallback only — real shops use the country chosen at signup. */
export const DEFAULT_COUNTRY = "IE";
export const DEFAULT_LOCALE = "en";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "UTC";

/** @deprecated Use vatPickerOptions(tenant.vatRates). Kept for older imports. */
export const IE_VAT_RATES = [
  { code: "STD", label: "Standard (23%)", rate: DEFAULT_VAT_RATES.STD },
  { code: "RED", label: "Reduced (13.5%)", rate: DEFAULT_VAT_RATES.RED },
  { code: "SEC", label: "Second reduced (9%)", rate: DEFAULT_VAT_RATES.SEC },
  { code: "LIV", label: "Super-reduced (4.8%)", rate: DEFAULT_VAT_RATES.LIV },
  { code: "ZER", label: "Zero (0%)", rate: 0 },
  { code: "EXE", label: "Exempt", rate: 0 },
] as const;

export type VatCode = GeoVatCode;

export const DEFAULT_VAT_CODE: VatCode = "STD";

export const PAYMENT_METHODS = [
  { code: "CASH", label: "Cash" },
  { code: "CARD", label: "Card" },
  { code: "CONTACTLESS", label: "Contactless" },
  { code: "APPLE_PAY", label: "Apple Pay" },
  { code: "GOOGLE_PAY", label: "Google Pay" },
  { code: "REVOLUT", label: "Revolut" },
  { code: "BANK_TRANSFER", label: "Bank transfer" },
  { code: "STORE_CREDIT", label: "Store credit" },
  { code: "CUSTOMER_ACCOUNT", label: "Customer account (B2B)" },
  { code: "VOUCHER", label: "Voucher / gift card" },
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]["code"];
