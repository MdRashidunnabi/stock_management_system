"use server";

import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import type { ProductSearchResult } from "@/lib/pos/schemas";

const LOOKUP_ROLES = ["owner", "manager", "cashier", "warehouse"] as const;

const PRODUCT_COLS =
  "id, name, primary_image_url, sku, barcode, extra_barcodes, base_unit, selling_price, vat_code, vat_included, is_active";

type ProductRow = {
  id: string;
  name: string;
  primary_image_url: string | null;
  sku: string | null;
  barcode: string | null;
  extra_barcodes: string[] | null;
  base_unit: string;
  selling_price: number | null;
  vat_code: string | null;
  vat_included: boolean | null;
  is_active: boolean | null;
};

function toSearchRow(p: ProductRow, available: number): ProductSearchResult {
  return {
    id: p.id,
    name: p.name,
    primary_image_url: p.primary_image_url ?? null,
    sku: p.sku,
    barcode: p.barcode,
    base_unit: p.base_unit,
    selling_price: Number(p.selling_price ?? 0),
    vat_code: p.vat_code ?? "STD",
    vat_included: p.vat_included ?? true,
    available,
  };
}

async function availableFor(productId: string, branchId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_balances")
    .select("quantity")
    .eq("product_id", productId)
    .eq("branch_id", branchId)
    .eq("state", "available")
    .is("variant_id", null)
    .maybeSingle();
  if (error) throw new ActionError(error.message);
  return Number(data?.quantity ?? 0);
}

/**
 * Exact barcode / SKU lookup for a HID scanner. Prefers the primary barcode,
 * then extra barcodes, then SKU.
 */
export const lookupProductByBarcodeAction = staffActionClient([...LOOKUP_ROLES])
  .metadata({ actionName: "catalog.lookupBarcode" })
  .inputSchema(
    z.object({
      branchId: entityIdSchema,
      code: z.string().trim().min(1).max(64),
    }),
  )
  .action(async ({ parsedInput }): Promise<{ ok: true; product: ProductSearchResult | null }> => {
    const supabase = await createClient();
    const code = parsedInput.code.trim();

    const { data: byBarcode, error: bcErr } = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("is_active", true)
      .eq("barcode", code)
      .maybeSingle();
    if (bcErr) throw new ActionError(bcErr.message);

    let product = (byBarcode as ProductRow | null) ?? null;

    if (!product) {
      const { data: extras, error: exErr } = await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .eq("is_active", true)
        .contains("extra_barcodes", [code])
        .limit(1);
      if (!exErr) product = (extras?.[0] as ProductRow | undefined) ?? null;
    }

    if (!product) {
      const { data: bySku, error: skuErr } = await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .eq("is_active", true)
        .eq("sku", code)
        .maybeSingle();
      if (skuErr) throw new ActionError(skuErr.message);
      product = (bySku as ProductRow | null) ?? null;
    }

    if (!product) return { ok: true, product: null };

    const available = await availableFor(product.id, parsedInput.branchId);
    return { ok: true, product: toSearchRow(product, available) };
  });
