import type postgres from "postgres";
import { POS_MISC_SKU } from "@/lib/pos/misc-product";

/** Fixed IDs for Needscarlow demo tenant (see seed-needscarlow.ts). */
export const NEEDSCARLOW_TENANT_ID = "00000000-0000-0000-0000-000000000002";
export const NEEDSCARLOW_BRANCH_ID = "00000000-0000-0000-0000-000000000011";
export const NEEDSCARLOW_SUPPLIER_ID = "00000000-0000-0000-0000-000000000201";

export const MISC_PRODUCT = {
  sku: POS_MISC_SKU,
  barcode: "5099009990001",
  name: "Miscellaneous sale",
  sellingPrice: 1.0,
  purchasePrice: 0,
  stockQty: 9999,
} as const;

/**
 * Catch-all POS product for items not in the catalogue.
 * Cashiers use One-off sale on POS to enter any VAT-inclusive amount.
 */
export async function ensureNeedscarlowMiscProduct(sql: postgres.Sql): Promise<void> {
  await sql`
    insert into public.categories (tenant_id, name, slug, position)
    values (${NEEDSCARLOW_TENANT_ID}, 'Miscellaneous', 'miscellaneous', 9999)
    on conflict (tenant_id, slug) do update set name = excluded.name
  `;

  await sql`
    insert into public.products (
      tenant_id, name, sku, barcode, category_id, default_supplier_id,
      purchase_price, selling_price, vat_code, vat_included, base_unit,
      primary_image_url, is_active, allow_pos_custom_price
    )
    select
      ${NEEDSCARLOW_TENANT_ID},
      ${MISC_PRODUCT.name},
      ${MISC_PRODUCT.sku},
      ${MISC_PRODUCT.barcode},
      (select id from public.categories where tenant_id = ${NEEDSCARLOW_TENANT_ID} and slug = 'miscellaneous' limit 1),
      ${NEEDSCARLOW_SUPPLIER_ID},
      ${MISC_PRODUCT.purchasePrice},
      ${MISC_PRODUCT.sellingPrice},
      'STD'::public.vat_code,
      true,
      'un',
      null,
      true,
      true
    on conflict (tenant_id, sku) do update set
      name = excluded.name,
      barcode = excluded.barcode,
      selling_price = excluded.selling_price,
      is_active = true,
      archived_at = null,
      allow_pos_custom_price = true
  `;

  await sql`
    insert into public.stock_balances (tenant_id, branch_id, product_id, state, quantity)
    select ${NEEDSCARLOW_TENANT_ID}, ${NEEDSCARLOW_BRANCH_ID}, id, 'available', ${MISC_PRODUCT.stockQty}
    from public.products
    where tenant_id = ${NEEDSCARLOW_TENANT_ID} and sku = ${MISC_PRODUCT.sku}
    on conflict (tenant_id, branch_id, product_id, variant_id, state) do update
      set quantity = excluded.quantity
  `;
}
