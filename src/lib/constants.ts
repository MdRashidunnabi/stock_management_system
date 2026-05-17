/**
 * Country / locale defaults for ShopOS Ireland.
 * These are runtime defaults; tenants can override per-shop where applicable.
 */

export const APP_NAME = "ShopOS";
export const APP_DESCRIPTION = "Retail Operating System for Irish independent shops.";

export const DEFAULT_COUNTRY = "IE";
export const DEFAULT_LOCALE = "en-IE";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "Europe/Dublin";

/**
 * Ireland VAT rates as of 2025/2026.
 * NOTE: tax rates change. Verify current values with a Revenue.ie-registered
 * accountant before relying on them for fiscal documents.
 */
export const IE_VAT_RATES = [
  { code: "STD", label: "Standard (23%)", rate: 0.23 },
  { code: "RED", label: "Reduced (13.5%)", rate: 0.135 },
  { code: "SEC", label: "Second Reduced (9%)", rate: 0.09 },
  { code: "LIV", label: "Livestock (4.8%)", rate: 0.048 },
  { code: "ZER", label: "Zero (0%)", rate: 0.0 },
  { code: "EXE", label: "Exempt", rate: 0.0 },
] as const;

export type VatCode = (typeof IE_VAT_RATES)[number]["code"];

export const DEFAULT_VAT_CODE: VatCode = "STD";

/**
 * Payment methods commonly used in Irish retail.
 */
export const PAYMENT_METHODS = [
  { code: "CASH", label: "Cash" },
  { code: "CARD", label: "Card" },
  { code: "CONTACTLESS", label: "Contactless" },
  { code: "APPLE_PAY", label: "Apple Pay" },
  { code: "GOOGLE_PAY", label: "Google Pay" },
  { code: "REVOLUT", label: "Revolut" },
  { code: "BANK_TRANSFER", label: "Bank Transfer (SEPA)" },
  { code: "STORE_CREDIT", label: "Store Credit" },
  { code: "CUSTOMER_ACCOUNT", label: "Customer Account (B2B)" },
  { code: "VOUCHER", label: "Voucher / Gift Card" },
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]["code"];
