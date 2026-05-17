"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
  type ListProductsArgs,
  type ProductFullRow,
  type ProductListRow,
  type productBaseSchema,
} from "@/lib/catalog/products/schemas";

const TABLE = "products";
const writableRoles = ["owner", "manager", "warehouse"] as const;

/* ------------------------------ Queries ------------------------------ */

export async function listProducts(args: ListProductsArgs = {}) {
  const {
    search,
    categoryId,
    brandId,
    supplierId,
    status = "active",
    page = 1,
    pageSize = 25,
  } = args;

  const supabase = await createClient();
  let query = supabase
    .from(TABLE)
    .select(
      `id, name, sku, barcode, base_unit, vat_code, vat_included,
       purchase_price, selling_price, is_active, archived_at,
       category:categories(id, name),
       brand:brands(id, name),
       supplier:suppliers!default_supplier_id(id, name, code)`,
      { count: "exact" },
    )
    .order("name", { ascending: true });

  if (status === "active") query = query.eq("is_active", true);
  if (status === "archived") query = query.eq("is_active", false);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (brandId) query = query.eq("brand_id", brandId);
  if (supplierId) query = query.eq("default_supplier_id", supplierId);
  if (search && search.trim().length > 0) {
    const needle = search.trim();
    query = query.or(`name.ilike.%${needle}%,sku.ilike.%${needle}%,barcode.ilike.%${needle}%`);
  }

  const from = (Math.max(1, page) - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load products: ${error.message}`);

  return {
    rows: (data ?? []) as ProductListRow[],
    total: count ?? 0,
    page: Math.max(1, page),
    pageSize,
  };
}

export async function getProduct(id: string): Promise<ProductFullRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      `id, name, sku, barcode, short_name_for_receipt, description_short, description_long,
       category_id, brand_id, default_supplier_id,
       purchase_price, selling_price, vat_code, vat_included, base_unit,
       weighable, decimal_qty_allowed, is_active, archived_at`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  return (data ?? null) as ProductFullRow | null;
}

/**
 * Lightweight category/brand/supplier lookups for the product form.
 */
export async function listLookupsForProductForm() {
  const supabase = await createClient();
  const [cats, brs, sups] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase.from("brands").select("id, name, slug, is_active").eq("is_active", true).order("name"),
    supabase
      .from("suppliers")
      .select("id, name, code, is_active")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (cats.error) throw new Error(cats.error.message);
  if (brs.error) throw new Error(brs.error.message);
  if (sups.error) throw new Error(sups.error.message);

  return {
    categories: cats.data ?? [],
    brands: brs.data ?? [],
    suppliers: sups.data ?? [],
  };
}

/* ------------------------------ Actions ------------------------------ */

export const createProductAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.create" })
  .inputSchema(createProductSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const row = toRow(ctx.tenant.tenantId, parsedInput);
    const { data, error } = await supabase.from(TABLE).insert(row).select("id").single();
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/products");
    return { ok: true as const, id: data.id };
  });

export const updateProductAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.update" })
  .inputSchema(updateProductSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { id, ...rest } = parsedInput;
    const { error } = await supabase
      .from(TABLE)
      .update(toRow(ctx.tenant.tenantId, rest))
      .eq("id", id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true as const };
  });

export const archiveProductAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.archive" })
  .inputSchema(productIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/products");
    return { ok: true as const };
  });

export const restoreProductAction = staffActionClient([...writableRoles])
  .metadata({ actionName: "products.restore" })
  .inputSchema(productIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: true, archived_at: null })
      .eq("id", parsedInput.id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(friendlyDbError(error));
    revalidatePath("/products");
    return { ok: true as const };
  });

/* ------------------------------ Helpers ------------------------------ */

function toRow(tenantId: string, input: z.output<typeof productBaseSchema>) {
  return {
    tenant_id: tenantId,
    name: input.name,
    sku: input.sku || null,
    barcode: input.barcode || null,
    short_name_for_receipt: input.shortNameForReceipt || null,
    description_short: input.descriptionShort || null,
    description_long: input.descriptionLong || null,
    category_id: input.categoryId || null,
    brand_id: input.brandId || null,
    default_supplier_id: input.defaultSupplierId || null,
    purchase_price: input.purchasePrice,
    selling_price: input.sellingPrice,
    vat_code: input.vatCode,
    vat_included: input.vatIncluded,
    base_unit: input.baseUnit,
    weighable: input.weighable,
    decimal_qty_allowed: input.decimalQtyAllowed,
    is_active: input.isActive,
    archived_at: input.isActive ? null : new Date().toISOString(),
  };
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("sku")) return "A product with that SKU already exists.";
    if (error.message.includes("barcode")) return "A product with that barcode already exists.";
    if (error.message.includes("seo_slug")) return "That online slug is already taken.";
    return "A product with these unique values already exists.";
  }
  if (error.code === "42501") return "You don't have permission to modify products.";
  return error.message;
}
