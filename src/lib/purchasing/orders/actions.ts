"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  type ProductLite,
  type PurchaseOrderFullRow,
  type PurchaseOrderListRow,
  type SupplierLite,
} from "@/lib/purchasing/schemas";

const PURCHASE_ROLES = ["owner", "manager", "warehouse"] as const;

/* ------------------------------ Mutations ------------------------------ */

export const createPurchaseOrderAction = staffActionClient([...PURCHASE_ROLES])
  .metadata({ actionName: "purchasing.createPurchaseOrder" })
  .inputSchema(createPurchaseOrderSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("create_purchase_order", {
        p_branch_id: parsedInput.branchId,
        p_supplier_id: parsedInput.supplierId,
        p_items: parsedInput.items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
          unit_cost: it.unitCost,
          vat_code: it.vatCode ?? "STD",
          notes: it.notes ?? null,
        })),
        p_expected_at: parsedInput.expectedAt ?? null,
        p_notes: parsedInput.notes ?? null,
      })
      .single();
    if (error) throw new ActionError(friendlyError(error));
    revalidatePath("/purchase-orders");
    revalidatePath("/dashboard");
    return {
      ok: true as const,
      poId: data.po_id,
      poNumber: data.po_number,
      total: Number(data.total),
    };
  });

export const updatePurchaseOrderStatusAction = staffActionClient([...PURCHASE_ROLES])
  .metadata({ actionName: "purchasing.updatePurchaseOrderStatus" })
  .inputSchema(updatePurchaseOrderStatusSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("purchase_orders")
      .select("id, status")
      .eq("id", parsedInput.poId)
      .maybeSingle();
    if (fetchErr) throw new ActionError(fetchErr.message);
    if (!existing) throw new ActionError("Purchase order not found.");

    const allowed: Record<string, string[]> = {
      draft: ["submitted", "cancelled"],
      submitted: ["cancelled"],
      partially_received: [],
      received: [],
      cancelled: [],
      closed: [],
    };
    const next = parsedInput.newStatus;
    if (!allowed[existing.status]?.includes(next)) {
      throw new ActionError(`Cannot change a ${existing.status} order to ${next}.`);
    }

    const patch: { status: typeof next; ordered_at?: string } = { status: next };
    if (next === "submitted") patch.ordered_at = new Date().toISOString();

    const { error } = await supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", parsedInput.poId);
    if (error) throw new ActionError(friendlyError(error));

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${parsedInput.poId}`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  });

/* ------------------------------- Queries ------------------------------- */

export async function listPurchaseOrders(limit = 100): Promise<PurchaseOrderListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `id, po_number, status, total, vat_total, expected_at, ordered_at, created_at,
       branch:branches!purchase_orders_branch_id_fkey(id, name, code),
       supplier:suppliers(id, name, code),
       items:purchase_order_items(count)`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load purchase orders: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    po_number: row.po_number,
    status: row.status,
    total: Number(row.total ?? 0),
    vat_total: Number(row.vat_total ?? 0),
    expected_at: row.expected_at,
    ordered_at: row.ordered_at,
    created_at: row.created_at,
    branch: pickOne(row.branch),
    supplier: pickOne(row.supplier),
    items_count: pickCount(row.items),
  }));
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderFullRow | null> {
  const supabase = await createClient();
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select(
      `id, tenant_id, po_number, status, subtotal, vat_total, total,
       expected_at, ordered_at, created_at, approved_at, notes, currency,
       branch:branches!purchase_orders_branch_id_fkey(id, name, code),
       supplier:suppliers(id, name, code)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (poErr) throw new Error(`Failed to load purchase order: ${poErr.message}`);
  if (!po) return null;

  const { data: items, error: itErr } = await supabase
    .from("purchase_order_items")
    .select(
      `id, product_id, quantity, unit_cost, vat_code, qty_received,
       qty_outstanding, line_subtotal, notes, position,
       product:products(id, name, sku)`,
    )
    .eq("purchase_order_id", id)
    .order("position", { ascending: true });
  if (itErr) throw new Error(`Failed to load purchase order items: ${itErr.message}`);

  const itemsCount = items?.length ?? 0;
  const itemsRows = (items ?? []).map((it) => {
    const prod = pickOne<{ id: string; name: string; sku: string | null }>(
      it.product as unknown as
        | { id: string; name: string; sku: string | null }
        | { id: string; name: string; sku: string | null }[]
        | null,
    );
    return {
      id: it.id,
      product_id: it.product_id,
      product_name: prod?.name ?? "(unknown)",
      product_sku: prod?.sku ?? null,
      quantity: Number(it.quantity ?? 0),
      unit_cost: Number(it.unit_cost ?? 0),
      vat_code: it.vat_code,
      qty_received: Number(it.qty_received ?? 0),
      qty_outstanding: Number(it.qty_outstanding ?? 0),
      line_subtotal: Number(it.line_subtotal ?? 0),
      notes: it.notes ?? null,
    };
  });

  return {
    id: po.id,
    tenant_id: po.tenant_id,
    po_number: po.po_number,
    status: po.status,
    subtotal: Number(po.subtotal ?? 0),
    vat_total: Number(po.vat_total ?? 0),
    total: Number(po.total ?? 0),
    expected_at: po.expected_at,
    ordered_at: po.ordered_at,
    created_at: po.created_at,
    approved_at: po.approved_at,
    notes: po.notes,
    currency: po.currency ?? "EUR",
    branch: pickOne(po.branch),
    supplier: pickOne(po.supplier),
    items_count: itemsCount,
    items: itemsRows,
  };
}

/* -------------------------------- Lookups ------------------------------- */

export async function listSuppliersForCurrentTenant(): Promise<SupplierLite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }));
}

export async function listProductsForPurchasing(
  query?: string,
  limit = 30,
): Promise<ProductLite[]> {
  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select("id, name, sku, base_unit, purchase_price, vat_code, default_supplier_id")
    .eq("is_active", true)
    .order("name")
    .limit(limit);

  const trimmed = query?.trim();
  if (trimmed) {
    q = q.or(`name.ilike.%${trimmed}%,sku.ilike.${trimmed}%,barcode.eq.${trimmed}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    base_unit: p.base_unit,
    purchase_price: p.purchase_price === null ? null : Number(p.purchase_price),
    vat_code: p.vat_code ?? "STD",
    default_supplier_id: p.default_supplier_id,
  }));
}

/* -------------------------------- Helpers ------------------------------- */

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function pickCount(value: { count: number }[] | { count: number } | null | undefined): number {
  if (!value) return 0;
  if (Array.isArray(value)) return Number(value[0]?.count ?? 0);
  return Number(value.count ?? 0);
}

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "You don't have permission to manage purchase orders.";
  if (error.code === "23503") return "Linked record (branch / supplier / product) was not found.";
  if (error.message?.includes("supplier does not belong")) {
    return "That supplier doesn't belong to this shop.";
  }
  if (error.message?.includes("product")) return error.message;
  return error.message;
}
