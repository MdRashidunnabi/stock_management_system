"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import { adjustStockSchema, type ProductBranchStockRow } from "@/lib/inventory/schemas";

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

  return (branches ?? []).map((b) => ({
    branchId: b.id,
    branchCode: b.code,
    branchName: b.name,
    availableQty: byBranch.get(b.id) ?? 0,
  }));
}

export const adjustStockAction = staffActionClient([...STOCK_ROLES])
  .metadata({ actionName: "inventory.adjustStock" })
  .inputSchema(adjustStockSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("apply_stock_adjustment", {
        p_branch_id: parsedInput.branchId,
        p_product_id: parsedInput.productId,
        p_reason: parsedInput.reason?.trim() ? parsedInput.reason : "",
        p_delta: parsedInput.mode === "delta" ? parsedInput.delta : null,
        p_new_quantity: parsedInput.mode === "set" ? parsedInput.newQuantity : null,
      })
      .single();

    if (error) throw new ActionError(friendlyAdjustError(error));

    revalidatePath("/products");
    revalidatePath(`/products/${parsedInput.productId}`);
    revalidatePath("/dashboard");
    revalidatePath("/pos");

    return {
      ok: true as const,
      adjustmentId: data.adjustment_id as string,
      previousQty: Number(data.previous_qty),
      newQty: Number(data.new_qty),
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
