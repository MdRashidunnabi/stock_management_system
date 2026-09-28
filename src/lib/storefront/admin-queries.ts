import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FulfillmentStage, UnavailablePolicy } from "@/lib/storefront/fulfillment";

export interface OnlineOrderRow {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  fulfillment_type: string;
  payment_method: string;
  delivery_fee: number;
  products_total: number;
  total: number;
  pickup_at: string | null;
  created_at: string;
  sale_id: string | null;
  fulfillment_stage: FulfillmentStage | string;
  wanted_for_date: string | null;
  is_advance: boolean;
}

export interface OnlineOrderLine {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  unavailable_policy: UnavailablePolicy | string;
  line_status: string;
  original_product_id: string | null;
  original_name: string | null;
  refunded_amount: number;
  category_id: string | null;
}

export interface SubstituteCandidate {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  available: number;
}

export interface OnlineOrderPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
  refunded_amount: number;
}

export interface OnlineOrderDetail {
  order: OnlineOrderRow & {
    customer_email: string | null;
    delivery_address: string | null;
    notes: string | null;
    branch_id: string;
  };
  items: OnlineOrderLine[];
  payment: OnlineOrderPayment | null;
}

export async function listOnlineOrdersForTenant(limit = 80): Promise<OnlineOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("online_orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, fulfillment_type, payment_method, delivery_fee, products_total, total, pickup_at, created_at, sale_id, fulfillment_stage, wanted_for_date, is_advance",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    delivery_fee: Number(r.delivery_fee ?? 0),
    products_total: Number(r.products_total ?? r.total ?? 0),
    total: Number(r.total ?? 0),
    fulfillment_stage: r.fulfillment_stage ?? "preparing",
    wanted_for_date: r.wanted_for_date ?? null,
    is_advance: Boolean(r.is_advance),
  }));
}

export async function getOnlineOrderDetail(orderId: string): Promise<OnlineOrderDetail | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("online_orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, customer_email, fulfillment_type, payment_method, delivery_fee, products_total, total, pickup_at, created_at, sale_id, fulfillment_stage, wanted_for_date, is_advance, delivery_address, notes, branch_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return null;

  const [{ data: items, error: iErr }, { data: payments, error: pErr }] = await Promise.all([
    supabase
      .from("online_order_items")
      .select(
        `id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, line_total_gross,
         unavailable_policy, line_status, original_product_id, refunded_amount`,
      )
      .eq("online_order_id", orderId)
      .order("position", { ascending: true }),
    supabase
      .from("payments")
      .select("id, method, amount, status, refunded_amount")
      .eq("online_order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (iErr) throw new Error(iErr.message);
  if (pErr) throw new Error(pErr.message);

  const productIds = [
    ...new Set(
      (items ?? []).flatMap((i) =>
        [i.product_id, i.original_product_id].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const productMeta = new Map<
    string,
    { barcode: string | null; category_id: string | null; name: string }
  >();
  if (productIds.length > 0) {
    const { data: prodRows } = await supabase
      .from("products")
      .select("id, name, barcode, category_id")
      .in("id", productIds);
    for (const p of prodRows ?? []) {
      productMeta.set(p.id, { barcode: p.barcode, category_id: p.category_id, name: p.name });
    }
  }

  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      fulfillment_type: order.fulfillment_type,
      payment_method: order.payment_method,
      delivery_fee: Number(order.delivery_fee ?? 0),
      products_total: Number(order.products_total ?? order.total ?? 0),
      total: Number(order.total ?? 0),
      pickup_at: order.pickup_at,
      created_at: order.created_at,
      sale_id: order.sale_id,
      fulfillment_stage: order.fulfillment_stage ?? "preparing",
      wanted_for_date: order.wanted_for_date,
      is_advance: Boolean(order.is_advance),
      delivery_address: order.delivery_address,
      notes: order.notes,
      branch_id: order.branch_id,
    },
    items: (items ?? []).map((row) => {
      const product = productMeta.get(row.product_id);
      const original = row.original_product_id ? productMeta.get(row.original_product_id) : null;
      return {
        id: row.id,
        product_id: row.product_id,
        name: row.name_snapshot,
        sku: row.sku_snapshot,
        barcode: product?.barcode ?? null,
        quantity: Number(row.quantity ?? 0),
        unit_price: Number(row.unit_price ?? 0),
        line_total: Number(row.line_total_gross ?? 0),
        unavailable_policy: row.unavailable_policy ?? "omit",
        line_status: row.line_status ?? "ok",
        original_product_id: row.original_product_id,
        original_name: original?.name ?? null,
        refunded_amount: Number(row.refunded_amount ?? 0),
        category_id: product?.category_id ?? null,
      };
    }),
    payment: payments?.[0]
      ? {
          id: payments[0].id,
          method: payments[0].method,
          amount: Number(payments[0].amount ?? 0),
          status: payments[0].status,
          refunded_amount: Number(payments[0].refunded_amount ?? 0),
        }
      : null,
  };
}

export async function listSubstituteCandidates(
  productId: string,
  categoryId: string | null,
  branchId: string,
): Promise<SubstituteCandidate[]> {
  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select("id, name, sku, barcode")
    .eq("is_active", true)
    .is("archived_at", null)
    .neq("id", productId)
    .order("name")
    .limit(24);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: balances } = await supabase
    .from("stock_balances")
    .select("product_id, quantity")
    .eq("branch_id", branchId)
    .eq("state", "available")
    .in("product_id", ids);

  const onHand = new Map<string, number>();
  for (const b of balances ?? []) {
    onHand.set(b.product_id, Number(b.quantity ?? 0));
  }

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      available: onHand.get(r.id) ?? 0,
    }))
    .filter((r) => r.available > 0)
    .slice(0, 12);
}

export interface PublicOrderTrack {
  orderNumber: string;
  fulfillmentType: string;
  stage: string;
  status: string;
  wantedForDate: string | null;
  isAdvance: boolean;
  items: Array<{ name: string; qty: number; lineStatus: string }>;
}

export async function getPublicOrderTracking(
  shopSlug: string,
  orderNumber: string,
  phone: string,
): Promise<PublicOrderTrack | null> {
  const admin = createAdminClient();
  const slug = shopSlug.trim().toLowerCase();
  const number = orderNumber.trim();
  const digits = phone.replace(/\D/g, "");
  if (!number || digits.length < 6) return null;

  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!tenant) return null;

  const { data: order } = await admin
    .from("online_orders")
    .select(
      "id, order_number, fulfillment_type, fulfillment_stage, status, wanted_for_date, is_advance, customer_phone",
    )
    .eq("tenant_id", tenant.id)
    .eq("order_number", number)
    .maybeSingle();
  if (!order) return null;

  const stored = (order.customer_phone ?? "").replace(/\D/g, "");
  if (!stored.endsWith(digits.slice(-6)) && stored !== digits) return null;

  const { data: items } = await admin
    .from("online_order_items")
    .select("name_snapshot, quantity, line_status")
    .eq("online_order_id", order.id)
    .order("position");

  return {
    orderNumber: order.order_number,
    fulfillmentType: order.fulfillment_type,
    stage: order.fulfillment_stage ?? "preparing",
    status: order.status,
    wantedForDate: order.wanted_for_date,
    isAdvance: Boolean(order.is_advance),
    items: (items ?? []).map((i) => ({
      name: i.name_snapshot,
      qty: Number(i.quantity ?? 0),
      lineStatus: i.line_status ?? "ok",
    })),
  };
}
