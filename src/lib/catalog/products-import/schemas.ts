import { z } from "zod";
import type { productBaseSchema } from "@/lib/catalog/products/schemas";

export interface ParsedProductRow {
  rowNumber: number;
  raw: Record<string, string>;
  ok: boolean;
  error?: string;
  payload?: z.output<typeof productBaseSchema> & {
    _category?: { id: string; name: string } | null;
    _brand?: { id: string; name: string } | null;
    _supplier?: { id: string; name: string } | null;
  };
}

export const parseCsvSchema = z.object({
  csvText: z.string().min(1, "CSV is empty").max(2_000_000, "CSV too large (max 2 MB)"),
});

export const commitImportSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().optional().nullable(),
        barcode: z.string().optional().nullable(),
        category_id: z.string().uuid().optional().nullable(),
        brand_id: z.string().uuid().optional().nullable(),
        default_supplier_id: z.string().uuid().optional().nullable(),
        purchase_price: z.number().min(0),
        selling_price: z.number().min(0),
        vat_code: z.enum(["STD", "RED", "SEC", "LIV", "ZER", "EXE"]),
        vat_included: z.boolean(),
        base_unit: z.string().min(1),
        is_active: z.boolean(),
      }),
    )
    .min(1, "Nothing to import")
    .max(1000, "At most 1000 rows per import"),
});
