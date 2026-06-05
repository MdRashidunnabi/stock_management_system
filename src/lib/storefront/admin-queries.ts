import "server-only";

import { createClient } from "@/lib/supabase/server";

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
}

export async function listOnlineOrdersForTenant(limit = 50): Promise<OnlineOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("online_orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, fulfillment_type, payment_method, delivery_fee, products_total, total, pickup_at, created_at, sale_id",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    delivery_fee: Number(r.delivery_fee ?? 0),
    products_total: Number(r.products_total ?? r.total ?? 0),
    total: Number(r.total ?? 0),
  }));
}
