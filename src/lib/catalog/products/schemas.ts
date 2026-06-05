import { z } from "zod";

export const VAT_CODES = ["STD", "RED", "SEC", "LIV", "ZER", "EXE"] as const;
export type VatCodeValue = (typeof VAT_CODES)[number];

const trimmedRequired = (max: number, label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .transform((v) => v.trim());

const trimmedOptional = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v ? v.trim() : v));

const skuSchema = z
  .string()
  .max(64)
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : v))
  .refine(
    (v) => !v || /^[A-Z0-9._-]+$/.test(v),
    "SKU may only contain letters, digits, dot, dash, underscore",
  );

const barcodeSchema = z
  .string()
  .max(64)
  .optional()
  .transform((v) => (v ? v.trim() : v))
  .refine((v) => !v || /^[A-Za-z0-9.-]+$/.test(v), "Barcode contains invalid characters");

/** Shelf / POS image: HTTPS URL or site path (e.g. /shops/needscarlow/...). */
export const primaryImageUrlSchema = z
  .string()
  .max(2000)
  .optional()
  .transform((v) => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : undefined;
  })
  .refine(
    (v) => v === undefined || /^https?:\/\//i.test(v) || v.startsWith("/"),
    "Use https://... or a path starting with /",
  );

const priceSchema = z
  .union([z.coerce.number().min(0).max(99999999), z.literal(NaN)])
  .transform((v) => (Number.isFinite(v) ? v : 0));

/** Empty = auto from selling price + shop markup %. Online-only; POS unchanged. */
const optionalOnlinePriceSchema = z
  .union([z.coerce.number().min(0).max(99999999), z.literal(""), z.literal(NaN), z.undefined()])
  .transform((v) => {
    if (v === "" || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return null;
    const n = Number(v);
    return n > 0 ? n : null;
  });

const onlineDiscountSchema = z
  .union([z.coerce.number().min(0).max(100), z.literal(NaN)])
  .transform((v) => (Number.isFinite(v) ? v : 0));

const idOrEmpty = z
  .string()
  .max(36)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine(
    (v) => !v || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    "Invalid id",
  );

export const productBaseSchema = z.object({
  name: trimmedRequired(200, "Product name"),
  sku: skuSchema,
  barcode: barcodeSchema,
  shortNameForReceipt: trimmedOptional(60),
  descriptionShort: trimmedOptional(500),
  descriptionLong: trimmedOptional(4000),
  categoryId: idOrEmpty,
  brandId: idOrEmpty,
  defaultSupplierId: idOrEmpty,
  purchasePrice: priceSchema,
  sellingPrice: priceSchema,
  onlineSellingPrice: optionalOnlinePriceSchema,
  onlineDiscountPct: onlineDiscountSchema,
  vatCode: z.enum(VAT_CODES).default("STD"),
  vatIncluded: z.boolean().default(true),
  baseUnit: z
    .string()
    .min(1, "Unit is required")
    .max(8)
    .default("un")
    .transform((v) => v.trim()),
  weighable: z.boolean().default(false),
  decimalQtyAllowed: z.boolean().default(false),
  isActive: z.boolean().default(true),
  primaryImageUrl: primaryImageUrlSchema,
});

export const createProductSchema = productBaseSchema;
export const updateProductSchema = productBaseSchema.extend({
  id: z.string().uuid("Invalid id"),
});
export const productIdSchema = z.object({ id: z.string().uuid("Invalid id") });

export type ProductFormInput = z.input<typeof createProductSchema>;
export type ProductFormOutput = z.output<typeof createProductSchema>;

export interface ProductListRow {
  id: string;
  name: string;
  primary_image_url: string | null;
  sku: string | null;
  barcode: string | null;
  base_unit: string;
  vat_code: string;
  vat_included: boolean;
  purchase_price: number;
  selling_price: number;
  is_active: boolean;
  archived_at: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  supplier: { id: string; name: string; code: string | null } | null;
  /** Available quantity at the branch selected on the products list (if any). */
  available_qty: number | null;
}

export interface ProductFullRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  short_name_for_receipt: string | null;
  description_short: string | null;
  description_long: string | null;
  category_id: string | null;
  brand_id: string | null;
  default_supplier_id: string | null;
  purchase_price: number;
  selling_price: number;
  online_selling_price: number | null;
  online_discount_pct: number | null;
  vat_code: string;
  vat_included: boolean;
  base_unit: string;
  weighable: boolean;
  decimal_qty_allowed: boolean;
  is_active: boolean;
  archived_at: string | null;
  primary_image_url: string | null;
}

export interface ListProductsArgs {
  search?: string;
  categoryId?: string | null;
  brandId?: string | null;
  supplierId?: string | null;
  status?: "all" | "active" | "archived";
  /** When set, each row includes available_qty from stock_balances at this branch. */
  branchId?: string | null;
  page?: number;
  pageSize?: number;
}
