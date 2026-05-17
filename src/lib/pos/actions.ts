"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import {
  commitSaleSchema,
  type ProductSearchResult,
  type SaleFullRow,
  type SaleListRow,
} from "@/lib/pos/schemas";

const POS_ROLES = ["owner", "manager", "cashier", "warehouse"] as const;

/* ------------------------------ Branches ------------------------------ */

export async function listBranchesForCurrentTenant() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, code, eircode")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Failed to load branches: ${error.message}`);
  return data ?? [];
}

/* ----------------------------- Searching ----------------------------- */

/**
 * Search products + their per-branch available stock. Used by the POS scan/
 * search box. Returns at most 20 hits, ordered by exact-match-first then name.
 */
export const searchProductsForPos = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.searchProducts" })
  .inputSchema(
    z.object({
      branchId: z.string().uuid(),
      query: z.string().min(1).max(120),
    }),
  )
  .action(async ({ parsedInput }): Promise<{ ok: true; rows: ProductSearchResult[] }> => {
    const supabase = await createClient();
    const q = parsedInput.query.trim();

    const { data: prods, error } = await supabase
      .from("products")
      .select("id, name, sku, barcode, base_unit, selling_price, vat_code, vat_included, is_active")
      .eq("is_active", true)
      .or(`name.ilike.%${q}%,sku.ilike.${q}%,barcode.eq.${q}`)
      .limit(20);
    if (error) throw new ActionError(error.message);

    const ids = (prods ?? []).map((p) => p.id);
    if (ids.length === 0) return { ok: true, rows: [] };

    // pull branch-level available balance for these products
    const { data: balances, error: bErr } = await supabase
      .from("stock_balances")
      .select("product_id, quantity")
      .eq("branch_id", parsedInput.branchId)
      .eq("state", "available")
      .in("product_id", ids);
    if (bErr) throw new ActionError(bErr.message);
    const byProduct = new Map<string, number>();
    for (const b of balances ?? []) byProduct.set(b.product_id, Number(b.quantity ?? 0));

    // exact-barcode match first, then exact-sku, then alpha
    const rows: ProductSearchResult[] = (prods ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      base_unit: p.base_unit,
      selling_price: Number(p.selling_price ?? 0),
      vat_code: p.vat_code ?? "STD",
      vat_included: p.vat_included ?? true,
      available: byProduct.get(p.id) ?? 0,
    }));

    rows.sort((a, b) => {
      const aExactBc = a.barcode === q ? 0 : 1;
      const bExactBc = b.barcode === q ? 0 : 1;
      if (aExactBc !== bExactBc) return aExactBc - bExactBc;
      const aSku = a.sku?.toLowerCase() === q.toLowerCase() ? 0 : 1;
      const bSku = b.sku?.toLowerCase() === q.toLowerCase() ? 0 : 1;
      if (aSku !== bSku) return aSku - bSku;
      return a.name.localeCompare(b.name);
    });

    return { ok: true, rows };
  });

/* ----------------------------- Commit sale ----------------------------- */

export const commitPosSaleAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.commitSale" })
  .inputSchema(commitSaleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("commit_pos_sale", {
        p_branch_id: parsedInput.branchId,
        p_items: parsedInput.items.map((i) => ({
          product_id: i.productId,
          qty: i.qty,
          discount: i.discount ?? 0,
        })),
        p_payments: parsedInput.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          external_ref: p.externalRef ?? null,
          card_brand: p.cardBrand ?? null,
          card_last4: p.cardLast4 ?? null,
        })),
        p_terminal_id: parsedInput.terminalId,
        p_session_id: parsedInput.sessionId,
        p_customer_id: parsedInput.customerId,
        p_rounding: parsedInput.rounding ?? 0,
        p_notes: parsedInput.notes,
      })
      .single();

    if (error) {
      throw new ActionError(friendlyRpcError(error));
    }

    revalidatePath("/pos");
    revalidatePath("/sales");
    revalidatePath("/dashboard");

    return {
      ok: true as const,
      saleId: data.sale_id,
      receiptNumber: data.receipt_number,
      total: Number(data.total),
      vatTotal: Number(data.vat_total),
      sessionId: data.pos_session_id,
    };
  });

/* ----------------------------- Sale queries ----------------------------- */

export async function listRecentSales(limit = 50): Promise<SaleListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, receipt_number, total, status, channel, created_at,
       customer:customers(id, full_name),
       branch:branches!sales_branch_id_fkey(id, name, code)`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load sales: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    receipt_number: row.receipt_number,
    total: Number(row.total ?? 0),
    status: row.status,
    channel: row.channel,
    created_at: row.created_at,
    customer: row.customer
      ? Array.isArray(row.customer)
        ? (row.customer[0] ?? null)
        : row.customer
      : null,
    branch: row.branch ? (Array.isArray(row.branch) ? (row.branch[0] ?? null) : row.branch) : null,
  }));
}

export async function getSale(id: string): Promise<SaleFullRow | null> {
  const supabase = await createClient();

  const { data: sale, error: sErr } = await supabase
    .from("sales")
    .select(
      `id, tenant_id, receipt_number, status, channel,
       subtotal, discount_total, vat_total, total, rounding, vat_breakdown,
       notes, created_at,
       branch:branches!sales_branch_id_fkey(id, name, code),
       customer:customers(id, full_name, email)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (sErr) throw new Error(`Failed to load sale: ${sErr.message}`);
  if (!sale) return null;

  const [{ data: items, error: iErr }, { data: payments, error: pErr }] = await Promise.all([
    supabase
      .from("sale_items")
      .select(
        `id, position, name_snapshot, sku_snapshot, quantity, unit_price,
         vat_code, vat_rate, discount, line_total_gross, line_total_net, line_vat`,
      )
      .eq("sale_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("payments")
      .select("id, method, amount, status, card_brand, card_last4, external_ref, captured_at")
      .eq("sale_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (iErr) throw new Error(`Failed to load sale items: ${iErr.message}`);
  if (pErr) throw new Error(`Failed to load payments: ${pErr.message}`);

  return {
    id: sale.id,
    tenant_id: sale.tenant_id,
    receipt_number: sale.receipt_number,
    status: sale.status,
    channel: sale.channel,
    subtotal: Number(sale.subtotal ?? 0),
    discount_total: Number(sale.discount_total ?? 0),
    vat_total: Number(sale.vat_total ?? 0),
    total: Number(sale.total ?? 0),
    rounding: Number(sale.rounding ?? 0),
    vat_breakdown:
      (sale.vat_breakdown as Record<string, { rate: number; base: number; vat: number }>) ?? {},
    notes: sale.notes,
    created_at: sale.created_at,
    branch: sale.branch
      ? Array.isArray(sale.branch)
        ? (sale.branch[0] ?? null)
        : sale.branch
      : null,
    customer: sale.customer
      ? Array.isArray(sale.customer)
        ? (sale.customer[0] ?? null)
        : sale.customer
      : null,
    items: (items ?? []).map((it) => ({
      id: it.id,
      position: it.position,
      name_snapshot: it.name_snapshot,
      sku_snapshot: it.sku_snapshot,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      vat_code: it.vat_code,
      vat_rate: Number(it.vat_rate ?? 0),
      discount: Number(it.discount ?? 0),
      line_total_gross: Number(it.line_total_gross ?? 0),
      line_total_net: Number(it.line_total_net ?? 0),
      line_vat: Number(it.line_vat ?? 0),
    })),
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount ?? 0),
      status: p.status,
      card_brand: p.card_brand,
      card_last4: p.card_last4,
      external_ref: p.external_ref,
      captured_at: p.captured_at,
    })),
  };
}

/* ------------------------------ Helpers ------------------------------ */

function friendlyRpcError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "You don't have permission to take payments on this shop.";
  if (error.code === "22023") return error.message;
  if (error.message?.includes("product not found")) {
    return "One of the products in the cart is no longer available.";
  }
  if (error.message?.includes("discount exceeds")) {
    return "A discount is bigger than the line price.";
  }
  return error.message;
}
