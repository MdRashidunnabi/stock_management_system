"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adjustStockSchema, type ProductBranchStockRow } from "@/lib/inventory/schemas";
import { isStockPool, stockLink } from "@/lib/inventory/stock-link";
import { applyPooledStock, listCutsOf, settlePools } from "@/lib/inventory/stock-pools";

const STOCK_ROLES = ["owner", "manager", "warehouse"] as const;

export async function getProductStockByBranch(productId: string): Promise<ProductBranchStockRow[]> {
  const supabase = await createClient();

  const { data: branches, error: bErr } = await supabase
    .from("branches")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");
  if (bErr) throw new Error(`Failed to load branches: ${bErr.message}`);

  const { data: balances, error: sErr } = await supabase
    .from("stock_balances")
    .select("branch_id, quantity")
    .eq("product_id", productId)
    .eq("state", "available")
    .is("variant_id", null);
  if (sErr) throw new Error(`Failed to load stock: ${sErr.message}`);

  const byBranch = new Map<string, number>();
  for (const row of balances ?? []) {
    byBranch.set(row.branch_id, Number(row.quantity ?? 0));
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, tenant_id, unit_conversions")
    .eq("id", productId)
    .maybeSingle();
  if (product && (stockLink(product.unit_conversions) || isStockPool(product.unit_conversions))) {
    for (const b of branches ?? []) {
      const stock = new Map([[product.id, byBranch.get(b.id) ?? 0]]);
      await applyPooledStock(
        supabase,
        { tenantId: product.tenant_id, branchId: b.id },
        [product],
        stock,
      );
      byBranch.set(b.id, stock.get(product.id) ?? 0);
    }
  }

  return (branches ?? []).map((b) => ({
    branchId: b.id,
    branchCode: b.code,
    branchName: b.name,
    availableQty: byBranch.get(b.id) ?? 0,
  }));
}

export type StockPoolInfo =
  | { kind: "cut"; source: { id: string; name: string; sku: string | null } }
  | { kind: "pool"; cuts: { id: string; name: string; sku: string | null }[] };

/** Whether a product is whole beef or lamb bought for cutting, or a cut sold from one. */
export async function getStockPoolInfo(productId: string): Promise<StockPoolInfo | null> {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, tenant_id, unit_conversions")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return null;
  const link = stockLink(product.unit_conversions);
  if (link) {
    const { data: source } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("id", link.from)
      .maybeSingle();
    return source ? { kind: "cut", source } : null;
  }
  if (!isStockPool(product.unit_conversions)) return null;
  const cuts = await listCutsOf(supabase, product.tenant_id, product.id);
  return { kind: "pool", cuts: cuts.map(({ id, name, sku }) => ({ id, name, sku })) };
}

export const adjustStockAction = staffActionClient([...STOCK_ROLES])
  .metadata({ actionName: "inventory.adjustStock" })
  .inputSchema(adjustStockSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();

    // A cut has no stock of its own, so a count or change goes to its purchase product.
    const { data: product } = await supabase
      .from("products")
      .select("id, unit_conversions")
      .eq("id", parsedInput.productId)
      .maybeSingle();
    const link = stockLink(product?.unit_conversions ?? null);
    const targetId = link?.from ?? parsedInput.productId;
    const factor = link?.factor ?? 1;
    if (link || isStockPool(product?.unit_conversions ?? null)) {
      await settlePools(
        createAdminClient(),
        { tenantId: ctx.tenant.tenantId, branchId: parsedInput.branchId },
        [targetId],
        {
          referenceType: "adjustment",
          userId: ctx.user.id,
          note: "Cuts emptied before a stock count",
        },
      );
    }

    const { data, error } = await supabase
      .rpc("apply_stock_adjustment", {
        p_branch_id: parsedInput.branchId,
        p_product_id: targetId,
        p_reason: parsedInput.reason?.trim() ? parsedInput.reason : "",
        p_delta:
          parsedInput.mode === "delta" && parsedInput.delta != null
            ? parsedInput.delta * factor
            : null,
        p_new_quantity:
          parsedInput.mode === "set" && parsedInput.newQuantity != null
            ? parsedInput.newQuantity * factor
            : null,
      })
      .single();

    if (error) throw new ActionError(friendlyAdjustError(error));

    revalidatePath("/products");
    revalidatePath(`/products/${parsedInput.productId}`);
    if (targetId !== parsedInput.productId) revalidatePath(`/products/${targetId}`);
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    revalidatePath("/stock/receive");

    return {
      ok: true as const,
      adjustmentId: data.adjustment_id as string,
      previousQty: Number(data.previous_qty) / factor,
      newQty: Number(data.new_qty) / factor,
    };
  });

function friendlyAdjustError(error: { message?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("cannot reduce below zero")) {
    return "Not enough stock to remove that amount.";
  }
  if (msg.includes("not allowed")) {
    return "Your role cannot adjust stock.";
  }
  if (msg.includes("Could not find the function") || msg.includes("apply_stock_adjustment")) {
    return "Stock adjustment is not set up on the database yet. Run: npx supabase migration up --local";
  }
  return msg || "Stock adjustment failed.";
}
