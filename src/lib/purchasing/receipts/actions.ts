"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import {
  createGoodsReceiptSchema,
  finaliseGoodsReceiptSchema,
  type GoodsReceiptFullRow,
  type GoodsReceiptListRow,
} from "@/lib/purchasing/schemas";

const PURCHASE_ROLES = ["owner", "manager", "warehouse"] as const;

/* ------------------------------ Mutations ------------------------------ */

export const createGoodsReceiptAction = staffActionClient([...PURCHASE_ROLES])
  .metadata({ actionName: "purchasing.createGoodsReceipt" })
  .inputSchema(createGoodsReceiptSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("create_goods_receipt", {
        p_branch_id: parsedInput.branchId,
        p_supplier_id: parsedInput.supplierId,
        p_items: parsedInput.items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
          unit_cost: it.unitCost,
          vat_code: it.vatCode ?? "STD",
          expiry_date: it.expiryDate ?? null,
          lot_no: it.lotNo ?? null,
          notes: it.notes ?? null,
        })),
        p_purchase_order_id: parsedInput.purchaseOrderId ?? null,
        p_invoice_number: parsedInput.invoiceNumber ?? null,
        p_invoice_total: parsedInput.invoiceTotal ?? null,
        p_received_at: parsedInput.receivedAt ?? null,
        p_notes: parsedInput.notes ?? null,
      })
      .single();
    if (error) throw new ActionError(friendlyError(error));
    revalidatePath("/goods-receipts");
    revalidatePath("/purchase-orders");
    revalidatePath("/dashboard");
    return { ok: true as const, grId: data.gr_id, grNumber: data.gr_number };
  });

export const finaliseGoodsReceiptAction = staffActionClient([...PURCHASE_ROLES])
  .metadata({ actionName: "purchasing.finaliseGoodsReceipt" })
  .inputSchema(finaliseGoodsReceiptSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("finalise_goods_receipt", { p_gr_id: parsedInput.grId })
      .single();
    if (error) throw new ActionError(friendlyError(error));
    revalidatePath("/goods-receipts");
    revalidatePath(`/goods-receipts/${parsedInput.grId}`);
    revalidatePath("/purchase-orders");
    if (data.po_id) revalidatePath(`/purchase-orders/${data.po_id}`);
    revalidatePath("/dashboard");
    return {
      ok: true as const,
      grId: data.gr_id,
      grNumber: data.gr_number,
      poId: data.po_id,
      poStatus: data.po_status,
      itemsCount: data.items_count,
    };
  });

/* -------------------------------- Queries -------------------------------- */

export async function listGoodsReceipts(limit = 100): Promise<GoodsReceiptListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(
      `id, gr_number, status, received_at, invoice_number, invoice_total, finalised_at,
       purchase_order_id,
       branch:branches!goods_receipts_branch_id_fkey(id, name, code),
       supplier:suppliers(id, name, code),
       po:purchase_orders(id, po_number),
       items:goods_receipt_items(count)`,
    )
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load goods receipts: ${error.message}`);

  return (data ?? []).map((row) => {
    const po = pickOne<{ id: string; po_number: string }>(row.po);
    return {
      id: row.id,
      gr_number: row.gr_number,
      status: row.status,
      received_at: row.received_at,
      invoice_number: row.invoice_number,
      invoice_total: row.invoice_total === null ? null : Number(row.invoice_total),
      finalised_at: row.finalised_at,
      branch: pickOne(row.branch),
      supplier: pickOne(row.supplier),
      purchase_order_id: row.purchase_order_id,
      po_number: po?.po_number ?? null,
      items_count: pickCount(row.items),
    };
  });
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceiptFullRow | null> {
  const supabase = await createClient();
  const { data: gr, error: grErr } = await supabase
    .from("goods_receipts")
    .select(
      `id, tenant_id, gr_number, status, received_at, invoice_number, invoice_total,
       finalised_at, purchase_order_id, notes,
       branch:branches!goods_receipts_branch_id_fkey(id, name, code),
       supplier:suppliers(id, name, code),
       po:purchase_orders(id, po_number)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (grErr) throw new Error(`Failed to load goods receipt: ${grErr.message}`);
  if (!gr) return null;

  const { data: items, error: itErr } = await supabase
    .from("goods_receipt_items")
    .select(
      `id, product_id, quantity, unit_cost, vat_code, expiry_date, lot_no, notes, position,
       product:products(id, name, sku)`,
    )
    .eq("goods_receipt_id", id)
    .order("position", { ascending: true });
  if (itErr) throw new Error(`Failed to load goods receipt items: ${itErr.message}`);

  const po = pickOne<{ id: string; po_number: string }>(gr.po);
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
      expiry_date: it.expiry_date,
      lot_no: it.lot_no,
      notes: it.notes ?? null,
    };
  });

  return {
    id: gr.id,
    tenant_id: gr.tenant_id,
    gr_number: gr.gr_number,
    status: gr.status,
    received_at: gr.received_at,
    invoice_number: gr.invoice_number,
    invoice_total: gr.invoice_total === null ? null : Number(gr.invoice_total),
    finalised_at: gr.finalised_at,
    purchase_order_id: gr.purchase_order_id,
    po_number: po?.po_number ?? null,
    notes: gr.notes,
    branch: pickOne(gr.branch),
    supplier: pickOne(gr.supplier),
    items_count: itemsRows.length,
    items: itemsRows,
  };
}

/* -------------------------------- Helpers -------------------------------- */

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
  if (error.code === "42501") return "You don't have permission to receive goods.";
  if (error.code === "22023") return error.message;
  if (error.message?.includes("supplier does not belong")) {
    return "That supplier doesn't belong to this shop.";
  }
  if (error.message?.includes("PO branch does not match")) {
    return "The receipt branch must match the original purchase order branch.";
  }
  if (error.message?.includes("not draft")) {
    return "This goods receipt has already been finalised or cancelled.";
  }
  return error.message;
}
