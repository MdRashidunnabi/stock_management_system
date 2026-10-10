"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { assertTillMaySell } from "@/lib/license/assert";
import {
  commitSaleSchema,
  type ProductSearchResult,
  type SaleFullRow,
  type SaleListRow,
} from "@/lib/pos/schemas";
import { productTextSearchOrFilter } from "@/lib/security/postgrest-filter";
import { assertLineDiscountAllowed } from "@/lib/security/discount-policy";
import { canAttachSaleToTill } from "@/lib/security/till-session";
import {
  makeVoucherCode,
  parseVoucherNote,
  voucherNoteLine,
  withVoucherNote,
} from "@/lib/vouchers/note";
import { earnedVoucherAmount, eligibleSpend, readPosVoucherSettings } from "@/lib/vouchers/rules";

const POS_ROLES = ["owner", "manager", "cashier", "warehouse", "accountant"] as const;

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
      branchId: entityIdSchema,
      query: z.string().min(1).max(120),
    }),
  )
  .action(async ({ parsedInput }): Promise<{ ok: true; rows: ProductSearchResult[] }> => {
    const supabase = await createClient();
    const q = parsedInput.query.trim();

    const { data: prods, error } = await supabase
      .from("products")
      .select(
        "id, name, primary_image_url, sku, barcode, base_unit, selling_price, vat_code, vat_included, is_active",
      )
      .eq("is_active", true)
      .or(productTextSearchOrFilter(q))
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
      primary_image_url: p.primary_image_url ?? null,
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

export const listPosCategories = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.categories" })
  .inputSchema(z.object({}))
  .action(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, position")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new ActionError(error.message);
    return { ok: true as const, rows: data ?? [] };
  });

export const listPosCategoryProducts = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.categoryProducts" })
  .inputSchema(
    z.object({
      branchId: entityIdSchema,
      categoryId: entityIdSchema,
    }),
  )
  .action(async ({ parsedInput }): Promise<{ ok: true; rows: ProductSearchResult[] }> => {
    const supabase = await createClient();
    const { data: prods, error } = await supabase
      .from("products")
      .select(
        "id, name, primary_image_url, sku, barcode, base_unit, selling_price, vat_code, vat_included, is_active",
      )
      .eq("is_active", true)
      .eq("category_id", parsedInput.categoryId)
      .order("name", { ascending: true })
      .limit(800);
    if (error) throw new ActionError(error.message);
    const ids = (prods ?? []).map((p) => p.id);
    const byProduct = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 150) {
      const slice = ids.slice(i, i + 150);
      const { data: balances, error: bErr } = await supabase
        .from("stock_balances")
        .select("product_id, quantity")
        .eq("branch_id", parsedInput.branchId)
        .eq("state", "available")
        .in("product_id", slice);
      if (bErr) throw new ActionError(bErr.message);
      for (const b of balances ?? []) byProduct.set(b.product_id, Number(b.quantity ?? 0));
    }
    const rows: ProductSearchResult[] = (prods ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      primary_image_url: p.primary_image_url ?? null,
      sku: p.sku,
      barcode: p.barcode,
      base_unit: p.base_unit,
      selling_price: Number(p.selling_price ?? 0),
      vat_code: p.vat_code ?? "STD",
      vat_included: p.vat_included ?? true,
      available: byProduct.get(p.id) ?? 0,
    }));
    return { ok: true, rows };
  });

/* ----------------------------- Commit sale ----------------------------- */

export const commitPosSaleAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.commitSale" })
  .inputSchema(commitSaleSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertTillMaySell(ctx.tenant.tenantId, parsedInput.deviceId);
    const supabase = await createClient();

    const deviceId = parsedInput.deviceId?.trim();
    let sessionId = parsedInput.sessionId;
    if (!deviceId && !sessionId) {
      throw new ActionError("Open a till on this computer first.");
    }
    if (deviceId) {
      const { data: tillSess, error: tillErr } = await supabase
        .from("pos_sessions")
        .select("id, cashier_id, status, branch_id")
        .eq("device_id", deviceId)
        .eq("status", "open")
        .maybeSingle();
      if (tillErr) throw new ActionError(tillErr.message);
      if (!tillSess) {
        throw new ActionError("Open a till on this computer first.");
      }
      if (tillSess.branch_id !== parsedInput.branchId) {
        throw new ActionError("This computer's till is open on another branch.");
      }
      sessionId = tillSess.id;
      const attach = canAttachSaleToTill({
        role: ctx.tenant.role,
        userId: ctx.user.id,
        sessionCashierId: tillSess.cashier_id ?? "",
        sessionStatus: tillSess.status ?? "",
      });
      if (!attach.ok) throw new ActionError(attach.error);
    } else if (sessionId) {
      const { data: sess } = await supabase
        .from("pos_sessions")
        .select("cashier_id, status")
        .eq("id", sessionId)
        .maybeSingle();
      const attach = canAttachSaleToTill({
        role: ctx.tenant.role,
        userId: ctx.user.id,
        sessionCashierId: sess?.cashier_id ?? "",
        sessionStatus: sess?.status ?? "",
      });
      if (!attach.ok) throw new ActionError(attach.error);
    }

    const discounted = parsedInput.items.filter((i) => (i.discount ?? 0) > 0);
    if (discounted.length > 0) {
      const ids = [...new Set(parsedInput.items.map((i) => i.productId))];
      const { data: prods } = await supabase
        .from("products")
        .select("id, selling_price")
        .in("id", ids);
      const priceById = new Map((prods ?? []).map((p) => [p.id, Number(p.selling_price ?? 0)]));
      for (const item of parsedInput.items) {
        const unit = item.unitPrice ?? priceById.get(item.productId) ?? 0;
        const allowed = parsedInput.voucherCode
          ? { ok: true as const }
          : assertLineDiscountAllowed({
              role: ctx.tenant.role,
              qty: item.qty,
              unitPrice: unit,
              discount: item.discount ?? 0,
            });
        if (!allowed.ok) throw new ActionError(allowed.error);
      }
    }

    if (parsedInput.voucherCode) {
      const valid = await findActivePosVoucher(ctx.tenant.tenantId, parsedInput.voucherCode);
      if (!valid) throw new ActionError("That voucher is not valid.");
    }

    const { data, error } = await supabase
      .rpc("commit_pos_sale", {
        p_branch_id: parsedInput.branchId,
        p_items: parsedInput.items.map((i) => ({
          product_id: i.productId,
          qty: i.qty,
          discount: i.discount ?? 0,
          ...(i.unitPrice != null ? { unit_price: i.unitPrice } : {}),
        })),
        p_payments: parsedInput.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          external_ref: p.externalRef ?? null,
          card_brand: p.cardBrand ?? null,
          card_last4: p.cardLast4 ?? null,
        })),
        p_terminal_id: parsedInput.terminalId,
        p_session_id: sessionId,
        p_customer_id: parsedInput.customerId,
        p_rounding: parsedInput.rounding ?? 0,
        p_notes: parsedInput.notes,
        p_client_uuid: parsedInput.clientUuid,
      })
      .single();

    if (error) {
      throw new ActionError(friendlyRpcError(error));
    }

    if (parsedInput.voucherCode) {
      await redeemPosVoucher(ctx.tenant.tenantId, parsedInput.voucherCode);
    }

    const voucher = await issueTillVoucher({
      supabase: createAdminClient(),
      tenantId: ctx.tenant.tenantId,
      saleId: data.sale_id,
      total: Number(data.total),
      voucherPaid: parsedInput.payments
        .filter((p) => p.method === "voucher")
        .reduce((sum, p) => sum + p.amount, 0),
    });

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
      voucher,
    };
  });

export const lookupPosVoucher = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.lookupVoucher" })
  .inputSchema(z.object({ code: z.string().trim().min(4).max(20) }))
  .action(async ({ parsedInput, ctx }) => {
    const found = await findActivePosVoucher(ctx.tenant.tenantId, parsedInput.code);
    if (!found) throw new ActionError("That voucher is not valid or has expired.");
    return { ok: true as const, code: found.code, amount: found.amount };
  });

async function findActivePosVoucher(tenantId: string, code: string) {
  const admin = createAdminClient();
  const clean = code.trim().toUpperCase();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: sales }, { data: orders }] = await Promise.all([
    admin
      .from("sales")
      .select("id, notes")
      .eq("tenant_id", tenantId)
      .ilike("notes", `%code=${clean}%`)
      .limit(10),
    admin
      .from("online_orders")
      .select("id, notes")
      .eq("tenant_id", tenantId)
      .ilike("notes", `%code=${clean}%`)
      .limit(10),
  ]);
  const rows = [
    ...(sales ?? []).map((row) => ({ ...row, table: "sales" as const })),
    ...(orders ?? []).map((row) => ({ ...row, table: "online_orders" as const })),
  ];
  for (const row of rows) {
    const voucher = parseVoucherNote(row.notes);
    if (
      voucher?.code === clean &&
      voucher.status === "active" &&
      (!voucher.expires || voucher.expires >= today)
    ) {
      return { ...voucher, id: row.id, table: row.table };
    }
  }
  return null;
}

async function redeemPosVoucher(tenantId: string, code: string) {
  const found = await findActivePosVoucher(tenantId, code);
  if (!found) return false;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from(found.table)
    .select("notes")
    .eq("id", found.id)
    .maybeSingle();
  await admin
    .from(found.table)
    .update({
      notes: withVoucherNote(row?.notes, {
        status: "redeemed",
        amount: found.amount,
        eligible: found.eligible,
        code: found.code,
        expires: found.expires,
      }),
    })
    .eq("id", found.id);
  return true;
}

async function issueTillVoucher(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  saleId: string;
  total: number;
  voucherPaid: number;
}) {
  const { data: tenant } = await input.supabase
    .from("tenants")
    .select("notes")
    .eq("id", input.tenantId)
    .maybeSingle();
  const settings = readPosVoucherSettings(tenant?.notes);
  if (!settings.enabled) return null;
  const eligible = eligibleSpend(input.total, input.voucherPaid);
  const amount = earnedVoucherAmount(eligible, settings.pct / 100);
  if (amount <= 0) return null;
  const code = makeVoucherCode();
  const expires = new Date();
  expires.setDate(expires.getDate() + settings.days);
  const expiresOn = expires.toISOString().slice(0, 10);
  const line = voucherNoteLine({
    status: "active",
    amount,
    eligible,
    code,
    expires: expiresOn,
  });
  const { data: sale } = await input.supabase
    .from("sales")
    .select("notes")
    .eq("id", input.saleId)
    .maybeSingle();
  const notes = [line, sale?.notes].filter(Boolean).join("\n");
  await input.supabase.from("sales").update({ notes }).eq("id", input.saleId);
  return { amount, code, expiresOn, days: settings.days };
}

/* ----------------------------- Sale queries ----------------------------- */

export async function listRecentSales(
  limit = 50,
  channel?: "pos" | "online" | "all",
): Promise<SaleListRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("sales")
    .select(
      `id, receipt_number, total, status, channel, created_at,
       customer:customers(id, full_name),
       branch:branches!sales_branch_id_fkey(id, name, code)`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (channel === "pos" || channel === "online") q = q.eq("channel", channel);
  const { data, error } = await q;
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
       notes, created_at, pos_session_id,
       branch:branches!sales_branch_id_fkey(id, name, code),
       customer:customers(id, full_name, email)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (sErr) throw new Error(`Failed to load sale: ${sErr.message}`);
  if (!sale) return null;

  const [{ data: items, error: iErr }, { data: payments, error: pErr }, sessionRes] =
    await Promise.all([
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
      sale.pos_session_id
        ? supabase
            .from("pos_sessions")
            .select("till_number")
            .eq("id", sale.pos_session_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  if (iErr) throw new Error(`Failed to load sale items: ${iErr.message}`);
  if (pErr) throw new Error(`Failed to load payments: ${pErr.message}`);
  const tillNumber =
    sessionRes.data && "till_number" in sessionRes.data && sessionRes.data.till_number != null
      ? Number(sessionRes.data.till_number)
      : null;

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
    till_number: tillNumber,
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
  if (error.message?.includes("custom price not allowed")) {
    return "This product cannot take a custom price on the till. Run db:seed:needscarlow:misc or enable it on the product.";
  }
  if (error.message?.includes("unit_price must be")) {
    return "The sale amount is out of range (€0.01–€99,999).";
  }
  return error.message;
}
