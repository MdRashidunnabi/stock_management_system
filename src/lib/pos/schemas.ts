import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";

/**
 * Zod schemas + types for the POS sale flow.
 * Imported by the cart UI AND the server action that commits the sale.
 */

export const PAYMENT_METHODS_VALUES = [
  "cash",
  "card",
  "contactless",
  "apple_pay",
  "google_pay",
  "revolut",
  "bank_transfer",
  "store_credit",
  "customer_account",
  "voucher",
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS_VALUES)[number];

export const cartItemInputSchema = z.object({
  productId: entityIdSchema,
  qty: z.coerce.number().min(0.0001, "Quantity must be > 0").max(99999, "Quantity is too large"),
  discount: z.coerce.number().min(0, "Discount must be >= 0").max(99999).optional(),
  /** Custom unit price for products with allow_pos_custom_price (one-off sales). */
  unitPrice: z.coerce
    .number()
    .min(0.01, "Price must be at least €0.01")
    .max(99999, "Price is too large")
    .optional(),
});

export const tenderInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS_VALUES),
  amount: z.coerce.number().min(0.01, "Amount must be > 0").max(99999999),
  externalRef: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v ? v.trim() : v)),
  cardBrand: z
    .string()
    .max(40)
    .optional()
    .transform((v) => (v ? v.trim() : v)),
  cardLast4: z
    .string()
    .max(4)
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "").slice(0, 4) : v)),
});

export const commitSaleSchema = z.object({
  branchId: entityIdSchema,
  terminalId: entityIdSchema.optional(),
  sessionId: entityIdSchema.optional(),
  customerId: entityIdSchema.optional(),
  rounding: z.coerce.number().min(-1).max(1).optional(),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ? v.trim() : v)),
  items: z.array(cartItemInputSchema).min(1, "Cart is empty").max(500, "Too many lines"),
  payments: z.array(tenderInputSchema).min(1, "At least one payment is required").max(10),
  /**
   * Optional idempotency key. The offline POS queue generates one per
   * pending sale and replays the same value on reconnect; the server
   * deduplicates so the cashier never charges twice.
   */
  clientUuid: entityIdSchema.optional(),
});

export type CommitSaleInput = z.input<typeof commitSaleSchema>;
export type CommitSaleOutput = z.output<typeof commitSaleSchema>;

/**
 * Cart item shape used inside the React cart state. Holds the snapshot of
 * the product as it was added (so the UI doesn't re-fetch on every render),
 * Server recomputes prices from the products table, except lines marked
 * allow_pos_custom_price on the product (one-off / misc) which may send unitPrice.
 */
export interface CartLine {
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  baseUnit: string;
  unitPrice: number;
  vatCode: string;
  vatIncluded: boolean;
  qty: number;
  discount: number;
  /** read-only, server-computed for display only */
  available?: number | null;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  primary_image_url: string | null;
  sku: string | null;
  barcode: string | null;
  base_unit: string;
  selling_price: number;
  vat_code: string;
  vat_included: boolean;
  available: number;
}

export interface SaleListRow {
  id: string;
  receipt_number: string;
  total: number;
  status: string;
  channel: string;
  created_at: string;
  customer: { id: string; full_name: string } | null;
  branch: { id: string; name: string; code: string } | null;
}

export interface SaleFullRow {
  id: string;
  tenant_id: string;
  receipt_number: string;
  status: string;
  channel: string;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  total: number;
  rounding: number;
  vat_breakdown: Record<string, { rate: number; base: number; vat: number }>;
  notes: string | null;
  created_at: string;
  branch: { id: string; name: string; code: string } | null;
  customer: { id: string; full_name: string; email: string | null } | null;
  items: Array<{
    id: string;
    position: number;
    name_snapshot: string;
    sku_snapshot: string | null;
    quantity: number;
    unit_price: number;
    vat_code: string;
    vat_rate: number;
    discount: number;
    line_total_gross: number;
    line_total_net: number;
    line_vat: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    card_brand: string | null;
    card_last4: string | null;
    external_ref: string | null;
    captured_at: string | null;
  }>;
}
